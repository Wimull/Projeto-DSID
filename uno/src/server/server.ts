//Código de entrada do servidor

import serverHandlers from './server-handlers'
import ipc from './server-ipc'
import net from 'net'
import { networkInterfaces } from 'os'

import * as game from './game'

import { onClientError, onMessage, startLeaderElection } from './callbacks'
// eslint-disable-next-line import/no-unresolved
import { v4 as uuid } from 'uuid'

export const SERVER_PORT = Math.round(Math.random() * 10000)

const nets = networkInterfaces()
const results = Object.create(null) // Or just '{}', an empty object

for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
        const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
        if (net.family === familyV4Value && !net.internal) {
            if (!results[name]) {
                results[name] = []
            }
            results[name].push(net.address)
        }
    }
}

export const [SERVER_ADDRESS] = Object.values(results)[0] as string[]

let isDev, version

if (process.argv[2] === '--subprocess') {
    isDev = false

    const socketName = process.argv[4]
    ipc.init(socketName, serverHandlers())
} else {
    isDev = true
}

export const connections: Map<string, net.Socket> = new Map([])

export function sendMessage(data: string, id: string) {
    const socket = connections.get(`${id}`)
    console.log(connections)
    console.log(`sending message ${data} to ${id}`)
    if (socket) {
        // TCP is a byte stream, not a message stream: if two messages are
        // written back-to-back they can arrive concatenated in a single
        // 'data' event on the other end (e.g. "{...}{...}"), which breaks
        // JSON.parse. Newline-delimit every message and split on it on the
        // receiving side (see handleIncomingData below) so each write maps
        // to exactly one parsed message, no matter how the OS batches them.
        socket.write(data + '\n')
    }
}

// Buffers partial/concatenated TCP data per connection and only forwards
// complete, individual JSON messages to onMessage.
const incomingBuffers: Map<string, string> = new Map()

function handleIncomingData(
    id: string,
    chunk: string,
    socketSendMessage: (message: string, serverId: string) => void
) {
    const buffered = (incomingBuffers.get(id) || '') + chunk
    const lines = buffered.split('\n')
    // The last entry is either '' (chunk ended exactly on a delimiter) or
    // an incomplete message that hasn't fully arrived yet — keep it buffered.
    incomingBuffers.set(id, lines.pop() ?? '')
    for (const line of lines) {
        if (line.length === 0) continue
        onMessage(line, id, socketSendMessage)
    }
}
const server = net.createServer()

export function connect(port: number, address: string) {
    const isConnected = new Promise((resolve) => {
        const connectionId = uuid()
        let hasThisConnectionBeenMade = false
        connections.forEach((s) => {
            if (s.remoteAddress === address && s.remotePort === port)
                hasThisConnectionBeenMade = true
        })
        if (hasThisConnectionBeenMade) {
            resolve([false, connectionId])
            return
        }
        const client = net.createConnection(
            { port: port, host: address },
            () => {
                console.log('Connected to ' + address + ':' + port)
                connections.set(connectionId, client)
                resolve([true, connectionId])
            }
        )
        client.on('data', (data) => {
            handleIncomingData(connectionId, data.toString(), sendMessage)
        })

        client.on('close', () => {
            const player = Array.from(
                game.connectedPlayersList,
                ([k, v]) => v
            ).find((p) => p.address === address && p.port === port)
            if (player) {
                if (player.isHost) startLeaderElection()
                game.disconnectPlayer(player.id)
                connections.delete(connectionId)
                ipc.send({
                    type: 'push',
                    name: 'error',
                    args: {
                        type: 'disconnect',
                        playerId: Array.from(
                            game.connectedPlayersList,
                            ([k, v]) => v
                        ).find((p) => p.address === address && p.port === port)!
                            .clientFakeId,
                    },
                })
            }
            incomingBuffers.delete(connectionId)
            console.log('Connection closed')
        })
        client.on('end', () => {
            console.log('Connection ended')
        })

        // Handle errors
        client.on('error', (err) => {
            console.log(err)
            const player = Array.from(
                game.connectedPlayersList,
                ([k, v]) => v
            ).find((p) => p.address === address && p.port === port)
            if (player) {
                if (player.isHost) startLeaderElection()
                game.disconnectPlayer(player.id)
            }
            connections.delete(connectionId)
            client.end()
            resolve([false, connectionId])
        })
    })
    return isConnected
}

server.on('connection', (connectionSocket) => {
    const id = uuid()
    console.log('client connected on: ', id)

    connections.set(id, connectionSocket)

    connectionSocket.on('data', (data) => {
        console.log('message received')
        handleIncomingData(id, data.toString(), sendMessage)
    })
    connectionSocket.on('error', (err) => {
        const player = Array.from(
            game.connectedPlayersList,
            ([k, v]) => v
        ).find((p) => p.serverId === id)
        if (player) {
            if (player.isHost) startLeaderElection()

            game.disconnectPlayer(player.id)
            connections.delete(id)
        }
        ipc.send({
            name: 'error',
            type: 'push',
            args: { data: { type: 'error', message: err.stack } },
        })

        connectionSocket.end()
    })

    connectionSocket.on('end', () => {
        const player = Array.from(
            game.connectedPlayersList,
            ([k, v]) => v
        ).find((p) => p.serverId === id)
        if (player) {
            if (player.isHost) startLeaderElection()
            game.disconnectPlayer(player.id)
            connections.delete(id)
            ipc.send({
                type: 'push',
                name: 'error',
                args: {
                    type: 'disconnect',
                    playerId: player.clientFakeId,
                },
            })
        }
        incomingBuffers.delete(id)
        connectionSocket.end()
        console.log('client disconnected')
    })
})

server.on('error', (err) => {
    console.error(`server error:\n${err.stack}`)
    ipc.send({
        name: 'error',
        type: 'push',
        args: { data: { type: 'error', message: err.stack } },
    })
    server.close()
})

server.on('close', () => {
    console.log('server closed')
})
server.on('listening', () => {
    const address = server.address()
    console.log(
        `server listening on ${
            address && typeof address === 'object' ? address.address : address
        }:${SERVER_PORT}`
    )
})

server.listen(SERVER_PORT, SERVER_ADDRESS)