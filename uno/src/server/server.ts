//Código de entrada do servidor

import serverHandlers from './server-handlers'
import ipc from './server-ipc'
import net from "node:net";

import * as game from "./game"

import { onClientError, onMessage } from "./callbacks.js";
import { v4 as uuid } from "uuid";

export const PORT = parseInt(Math.round(Math.random() * 1000));

let isDev, version

if (process.argv[2] === '--subprocess') {
    isDev = false

    const socketName = process.argv[4]
    ipc.init(socketName, serverHandlers(PORT) as any)
} else {
    isDev = true
}

console.log(isDev)



export const connections: Map<string, net.Socket> = new Map([]);

export function sendMessage(data: string, port: number, address: string) {
	console.log(`sending message ${data} to ${address}:${port}`);
	const socket = connections.get(`${address}:${port}`);
	if (socket) {
		socket.write(data);
	}
}
const server = net.createServer();


export function connect(port: number, address: string){
	const isConnected = new Promise((resolve) => {

    const client = new net.Socket()
    console.log("Connected to " + address + ":" + port)

    client.connect(parseInt(port), address, () => {
		resolve(true)
        connections.set(`${address}:${port}`, client)
    })
	connectionSocket.on("data", (data) => {
		console.log("message received");
		onMessage(data.toString(), address, port, sendMessage);
	});

    client.on("close", () => {
		connections.delete(`${address}:${port}`);
		ipc.send({type: "push", name: "error", args: {
			type: "disconnect",
			playerId: Array.from(game.connectedPlayersList, ([k, v]) => v).find(p => p.address === address && p.port === port).clientFakeId
		}})
        console.log("Connection closed");
    });
    client.on("end", () => {
		connections.delete(`${address}:${port}`);
        console.log("Connection ended");
    });
    
    // Handle errors
	client.on("error", (err) => {
		onClientError(err,  address, port,sendMessage);
		connections.delete(`${address}:${port}`);
		client.end();
	});
})
return isConnected
}

server.on("connection", (connectionSocket) => {
	const id = uuid();
	console.log("client connected");

	connections.set(`${connectionSocket.localAddress}:${connectionSocket.localPort}`, connectionSocket);

	connectionSocket.on("data", (data) => {
		console.log("message received");
		onMessage(data.toString(), connectionSocket.localAddress, connectionSocket.localPort, sendMessage);
	});
	connectionSocket.on("error", (err) => {
		onClientError(err, id, 0, sendMessage);
        ipc.send({name: "error", type: "push", args: {data: {type: "error", message: err.stack}}})
		connections.delete(`${connectionSocket.localAddress}:${connectionSocket.localPort}`);
		connectionSocket.end();
	});

	connectionSocket.on("end", () => {
		connections.delete(`${connectionSocket.localAddress}:${connectionSocket.localPort}`);
		ipc.send({type: "push", name: "error", args: {
			type: "disconnect",
			playerId: Array.from(game.connectedPlayersList, ([k, v]) => v).find(p => p.address === connectionSocket.localAddress && p.port === connectionSocket.localPort
				).clientFakeId
		}})
		connectionSocket.end();
		console.log("client disconnected");
	});
});

server.on("error", (err) => {
	console.error(`server error:\n${err.stack}`);
    ipc.send({name: "error", type: "push", args: {data: {type: "error", message: err.stack}}})
	server.close();
});

server.on("close", () => {
	console.log("server closed");
});
server.on("listening", () => {
	const address = server.address();
	console.log(
		`server listening on ${
			address && typeof address === "object" ? address.address : address
		}:${PORT}`
	);
});

server.listen(PORT);