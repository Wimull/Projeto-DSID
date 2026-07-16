// Funções acessadas pela front end com a função `send(nomeDoHandler)`

import { disconnectPlayer, ensureLeader, sendMessage } from './callbacks'
import * as game from './game'
import { connect } from './server'
// eslint-disable-next-line import/no-unresolved
import { v4 as uuid } from 'uuid'
import { Card, ServerSidePlayer } from './types'

function serverHandlers(port: number) {
    const handlers = {
        disconnect: async () => {
            game.connectedPlayersList.forEach((p) => {
                if (p.id !== game.user.id) {
                    disconnectPlayer(p)
                }
            })
            return
        },
        action: async (data: {
            type: 'draw' | 'playCard'
            card: Card
            selectedColor?: 'red' | 'green' | 'yellow' | 'blue'
        }) => {
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
                const { game: newGame, cardDrawn } = game.drawCard(game.user.id)
                game.connectedPlayersList.forEach((p) => {
                    if (p.id !== game.user.id) {
                        sendMessage(p, {
                            type: 'Action',
                            data: {
                                actionType: 'draw',
                                player: game.user,
                                cardDrawn,
                                playerTurnId: newGame.playerTurnId,
                                game: newGame,
                            },
                        })
                    }

                    if (p.isHost && !game.user.isHost) {
                        sendMessage(p, {
                            type: 'ActionDecision',
                            data: {
                                player: game.user,
                                doesPass: true,
                            },
                        })
                    }
                })
            } else {
                const { game: newGame } = game.playCard(
                    game.user.id,
                    data.card,
                    data.selectedColor
                )
                game.connectedPlayersList.forEach((p) => {
                    if (p.id !== game.user.id) {
                        sendMessage(p, {
                            type: 'Action',
                            data: {
                                actionType: 'playCard',
                                player: game.user,
                                cardPlayed: data.card,
                                selectedColor: data.selectedColor,
                                playerTurnId: newGame.playerTurnId,
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
        },
        createLobby: async ({ playerName }: { playerName: string }) => {
            game.user.id = uuid()
            game.user.clientFakeId = uuid()
            game.user.name = playerName
            game.connectedPlayersList.set(game.user.id, game.user)
            ensureLeader({ notify: false })
            return {
                port,
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
            game.user.id = uuid()
            game.user.clientFakeId = uuid()
            game.user.name = playerName
            game.connectedPlayersList.set(game.user.id, game.user)
            ensureLeader({ notify: false })
            const [address, port] = lobbyIp.split(':')
            connect(parseInt(port), address).then((success) => {
                if (!success) return
                const host: ServerSidePlayer = {
                    actionDecision: 'null',
                    address: address,
                    clientFakeId: '',
                    hand: [],
                    id: '',
                    isHost: true,
                    isReady: false,
                    messagesSentWithoutACK: [],
                    name: '',
                    port: parseInt(port),
                    timeoutKeepAlive: setTimeout(() => undefined, 0),
                    timeoutEndConnection: setTimeout(() => undefined, 0),
                    isUser: false,
                }
                sendMessage(host, {
                    type: 'TryConnect',
                    data: {
                        player: game.user,
                    },
                })
            })
        },
    }
    return handlers
}

export default serverHandlers
