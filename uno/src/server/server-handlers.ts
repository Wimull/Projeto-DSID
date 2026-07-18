// Funções acessadas pela front end com a função `send(nomeDoHandler)`

import {
    disconnectPlayer,
    ensureLeader,
    sendMessage,
    setPlayerAction,
} from './callbacks'
import * as game from './game'
import {
    connect,
    sendMessage as socketSendMessage,
    SERVER_PORT,
    SERVER_ADDRESS,
    connections,
} from './server'
// eslint-disable-next-line import/no-unresolved
import { v4 as uuid } from 'uuid'
import { Card, Player, ServerSidePlayer } from './types'
import { json } from 'node:stream/consumers'

function serverHandlers() {
    const handlers = {
        changeIsReady: async ({ isReady }: { isReady: boolean }) => {
            game.user.isReady = isReady
            game.connectedPlayersList.forEach((p) => {
                if (p.id === game.user.id) return
                sendMessage(p, {
                    type: isReady
                        ? 'PlayerReadyStartGame'
                        : 'PlayerCancelReadyStartGame',
                    data: {
                        player: game.user,
                    },
                })
            })
            return { isReady }
        },
        disconnect: async () => {
            game.connectedPlayersList.forEach((p) => {
                if (p.id !== game.user.id) {
                    game.disconnectPlayer(p.id)
                    sendMessage(p, {
                        type: 'Disconnect',
                        data: { player: game.user },
                    })
                }
            })
            connections.forEach((s) => {
                s.end()
            })
            connections.clear()
            return
        },
        action: async (data: {
            type: 'draw' | 'playCard'
            card: Card
            selectedColor?: 'red' | 'green' | 'yellow' | 'blue'
        }) => {
            console.log(data)
            if (game.user.isHost) {
                game.connectedPlayersList.forEach((p) => {
                    p.actionDecision = 'null'
                })
                const player = game.connectedPlayersList.get(game.user.id)
                if (player) {
                    game.connectedPlayersList.set(game.user.id, {
                        ...player,
                        actionDecision: 'pass',
                    })
                }
            }
            if (data.type === 'draw') {
                const {
                    game: newGame,
                    cardDrawn,
                    nextPlayerTurnId,
                } = game.drawCard(game.user.id)
                setPlayerAction({
                    player: newGame.players.find((p) => p.id === game.user.id)!,
                    actionType: 'draw',
                    cardDrawn,
                    playerTurnId: nextPlayerTurnId,
                })
                game.connectedPlayersList.forEach((p) => {
                    if (p.id !== game.user.id) {
                        sendMessage(p, {
                            type: 'Action',
                            data: {
                                actionType: 'draw',
                                player: game.user,
                                cardDrawn,
                                playerTurnId: nextPlayerTurnId,
                                game: newGame,
                            },
                        })
                    }
                })
            } else {
                const { game: newGame, nextPlayerTurnId } = game.playCard(
                    game.user.id,
                    data.card,
                    data.selectedColor
                )
                setPlayerAction({
                    player: newGame.players.find((p) => p.id === game.user.id)!,
                    actionType: 'playCard',
                    cardPlayed: data.card,
                    selectedColor: data.selectedColor,
                    playerTurnId: nextPlayerTurnId,
                })
                game.connectedPlayersList.forEach((p) => {
                    if (p.id !== game.user.id) {
                        sendMessage(p, {
                            type: 'Action',
                            data: {
                                actionType: 'playCard',
                                player: game.user,
                                cardPlayed: data.card,
                                selectedColor: data.selectedColor,
                                playerTurnId: nextPlayerTurnId,
                                game: newGame,
                            },
                        })
                    }
                })
            }
        },
        startGame: async () => {
            const seed = Math.round(Math.random() * 10000)
            const newGame = game.startGame(
                Array.from(game.connectedPlayersList, ([, value]) => value),
                seed
            )
            game.connectedPlayersList.forEach((p) => {
                if (p.id === game.user.id) return
                sendMessage(p, {
                    type: 'StartGame',
                    data: {
                        ...newGame,
                        player: game.user,
                    },
                })
            })
            return {
                players: newGame.players.map((p) => ({
                    id: p.clientFakeId,
                    isHost: p.isHost,
                    isReady: p.isReady,
                    name: p.name,
                    isUser: p.isUser,
                    hand: p.hand.map((c) => ({
                        id: c.id,
                        card: p.isUser ? c.card : 'back',
                    })),
                })),

                starterPlayerTurnId:
                    newGame.players.find((p) => p.id === newGame.playerTurnId)
                        ?.clientFakeId || '',
                starterPlayedCard: newGame.playedCard,
                starterColor: newGame.selectedColor,
            } as {
                players: Player[]
                starterPlayerTurnId: string
                starterPlayedCard: Card
                starterColor: string
            }
        },
        createLobby: async ({ playerName }: { playerName: string }) => {
            game.user.id = uuid()
            game.user.clientFakeId = uuid()
            game.user.name = playerName
            ;((game.user.port = SERVER_PORT),
                (game.user.address = SERVER_ADDRESS))
            game.connectedPlayersList.set(game.user.id, game.user)
            ensureLeader({ notify: false })
            return {
                port: SERVER_PORT,
                playerId: game.user.clientFakeId,
            }
        },
        connectToLobby: async ({
            ip: lobbyIp,
            playerName,
        }: {
            ip: string
            playerName: string
        }) => {
            console.log('try to connect to: ' + lobbyIp)
            game.user.id = uuid()
            game.user.clientFakeId = uuid()
            game.user.name = playerName
            ;((game.user.port = SERVER_PORT),
                (game.user.address = SERVER_ADDRESS))
            game.connectedPlayersList.set(game.user.id, game.user)
            ensureLeader({ notify: false })
            const ip = lobbyIp.split(':')
            const address = ip[ip.length - 2]
            const port = ip[ip.length - 1]
            connect(parseInt(port), address).then(
                ([success, serverId]: any) => {
                    console.log(success)
                    if (!success) return
                    socketSendMessage(
                        JSON.stringify({
                            type: 'TryConnect',
                            data: {
                                player: game.user,
                            },
                        }),
                        serverId
                    )
                }
            )
        },
    }
    return handlers
}

export default serverHandlers
