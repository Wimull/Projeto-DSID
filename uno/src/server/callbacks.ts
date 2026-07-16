import type { ServerSidePlayer, Message, Card } from './types'

import ipc from './server-ipc'

import {
    PORT,
    connections,
    connect,
    sendMessage as socketSendMessage,
} from './server'

import * as game from './game'

type SocketSendMessage = (
    message: string,
    port: number,
    address: string
) => void

const ELECTION_TIMEOUT_MS = 5000

const leaderElectionState = {
    currentTerm: 0,
    votedFor: null as string | null,
    leaderId: null as string | null,
    electionTimer: undefined as NodeJS.Timeout | undefined,
}

function clearLeaderElectionTimer() {
    if (leaderElectionState.electionTimer) {
        clearTimeout(leaderElectionState.electionTimer)
        leaderElectionState.electionTimer = undefined
    }
}

function resetLeaderElectionTimer() {
    clearLeaderElectionTimer()
    leaderElectionState.electionTimer = setTimeout(() => {
        if (!leaderElectionState.leaderId) {
            startLeaderElection({ notify: true })
        }
    }, ELECTION_TIMEOUT_MS)
}

function announceLeaderChange(player: ServerSidePlayer) {
    game.connectedPlayersList.forEach((connectedPlayer) => {
        connectedPlayer.isHost = connectedPlayer.id === player.id
    })
    game.user.isHost = game.user.id === player.id
    ipc.send({
        type: 'push',
        name: 'changeHost',
        args: {
            playerId: player.clientFakeId,
        },
    })
}

function becomeLeader(player: ServerSidePlayer, notify = true) {
    leaderElectionState.currentTerm += 1
    leaderElectionState.votedFor = player.id
    leaderElectionState.leaderId = player.id
    if (notify) {
        announceLeaderChange(player)
    }
    resetLeaderElectionTimer()
    return player
}

export function startLeaderElection({
    notify = true,
}: { notify?: boolean } = {}) {
    const connectedPlayers = Array.from(game.connectedPlayersList.values())

    if (connectedPlayers.length === 0) {
        leaderElectionState.leaderId = null
        leaderElectionState.votedFor = null
        game.user.isHost = false
        clearLeaderElectionTimer()
        return undefined
    }

    leaderElectionState.currentTerm += 1
    const candidate = connectedPlayers[0]
    leaderElectionState.votedFor = candidate.id

    const majority = Math.max(1, Math.floor(connectedPlayers.length / 2) + 1)
    const votes = new Set([candidate.id])

    connectedPlayers.forEach((player) => {
        if (player.id !== candidate.id) {
            votes.add(player.id)
        }
    })

    if (votes.size >= majority) {
        return becomeLeader(candidate, notify)
    }

    resetLeaderElectionTimer()
    return undefined
}

export function ensureLeader({ notify = true }: { notify?: boolean } = {}) {
    const connectedPlayers = Array.from(game.connectedPlayersList.values())

    if (connectedPlayers.length === 0) {
        leaderElectionState.leaderId = null
        leaderElectionState.votedFor = null
        game.user.isHost = false
        clearLeaderElectionTimer()
        return undefined
    }

    const currentLeader = connectedPlayers.find(
        (player) => player.id === leaderElectionState.leaderId
    )

    if (currentLeader) {
        game.connectedPlayersList.forEach((player) => {
            player.isHost = player.id === currentLeader.id
        })
        game.user.isHost = game.user.id === currentLeader.id
        resetLeaderElectionTimer()
        return currentLeader
    }

    return startLeaderElection({ notify })
}

export function sendMessage(
    player: ServerSidePlayer,
    message: Omit<Message, 'messageNum'>
) {
    const messageNum =
        player.messagesSentWithoutACK[player.messagesSentWithoutACK.length - 1]
            ?.messageNum || 0

    const resendTimeout = setTimeout(() => {
        player.messagesSentWithoutACK.forEach((m) => {
            if (m.messageNum === messageNum) {
                m.resend(resendTimeout, messageNum)
            }
        })
    }, 1000)
    const send = (resendTimeout: NodeJS.Timeout, messageNum: number) => {
        socketSendMessage(
            JSON.stringify({ ...message, messageNum: messageNum }),
            player.port,
            player.address
        )
        resendTimeout.refresh()
    }
    if (message.type === 'ACK') return send(resendTimeout, messageNum)
    player.messagesSentWithoutACK.push({
        resend: send,
        messageNum: messageNum,
        timeout: resendTimeout,
    })
    send(resendTimeout, messageNum)
}

export function disconnectPlayer(player: ServerSidePlayer) {
    const wasLeader =
        player.id === leaderElectionState.leaderId || player.isHost

    clearTimeout(player.timeoutKeepAlive)
    clearTimeout(player.timeoutEndConnection)
    player.messagesSentWithoutACK.forEach((m) => clearTimeout(m.timeout))
    game.disconnectPlayer(player.id)

    if (wasLeader) {
        ensureLeader({ notify: true })
    }

    ipc.send({
        type: 'push',
        name: 'error',
        args: {
            type: 'disconnect',
            playerId: player.clientFakeId,
        },
    })
    connections.get(`${player.address}:${player.port}`)?.end()
}

export function onMessage(
    msg: string,
    address: string,
    port: number,
    socketSendMessage: SocketSendMessage
) {
    const messageJSON: Message = JSON.parse(msg)
    const { data, messageNum: clientMessageNum, type } = messageJSON
    console.log(`server got a message type ${type} from ${address}:${port}`)

    const ACKRes: Partial<Message> = {
        type: 'ACK',
        messageNum: clientMessageNum,
        data: {
            ...game.user,
            player: game.user,
        },
    }

    if (type !== 'ACK')
        socketSendMessage(
            JSON.stringify({
                ...ACKRes,
                data: { ...game.connectedPlayersList.get('localhost:' + PORT) },
            }),
            port,
            address
        )
    let playerAction:
        | {
              player: ServerSidePlayer
              actionType: 'draw'
              cardDrawn: Card
              playerTurnId: string
          }
        | {
              player: ServerSidePlayer
              actionType: 'playCard'
              cardPlayed: Card
              selectedColor?: 'blue' | 'red' | 'green' | 'yellow'
              playerTurnId: string
          } = {
        actionType: 'draw',
        player: game.user,
        cardDrawn: { id: '1', card: 'blue1' },
        playerTurnId: game.game.playerTurnId,
    }

    switch (type) {
        case 'TryConnect': {
            if (game.game.players.length < 4) {
                game.connectPlayer(data.player)
                ensureLeader({ notify: true })
                sendMessage(data.player, {
                    type: 'ConnectionAccepted',
                    data: {
                        player: game.user,
                        players: Array.from(
                            game.connectedPlayersList,
                            ([, value]) => value
                        ),
                    },
                })
            } else {
                sendMessage(data.player, {
                    type: 'ConnectionDenied',
                    data: {
                        player: data.player,
                    },
                })
            }
            break
        }
        case 'ConnectionAccepted': {
            data.players.forEach((p: ServerSidePlayer) => {
                connect(p.port, p.address).then((success) => {
                    if (!success) return
                    sendMessage(p, {
                        type: 'Connect',
                        data: { player: game.user },
                    })
                    ipc.send({
                        type: 'push',
                        name: 'acceptConnect',
                        args: {
                            port: PORT,
                            players: data.players.map((p) => ({
                                name: p.name,
                                hand: p.hand,
                                id: p.clientFakeId,
                                isHost: p.isHost,
                                isReady: p.isReady,
                                isUser: game.user.id === p.id,
                            })),
                        },
                    })
                })
            })
            break
        }
        case 'ConnectionDenied': {
            ipc.send({
                type: 'push',
                name: 'error',
                args: { type: 'error', message: 'Sala cheia' },
            })
            break
        }
        case 'Connect': {
            ipc.send({
                type: 'push',
                name: 'connect',
                args: {
                    playerId: data.player.clientFakeId,
                    playerName: data.player.name,
                },
            })
            break
        }
        case 'Disconnect': {
            const player = game.connectedPlayersList.get(data.player.id)
            if (player) disconnectPlayer(player)
            break
        }

        case 'KeepAlive': {
            const player = game.connectedPlayersList.get(data.player.id)
            if (player) {
                player.timeoutKeepAlive.refresh()
                player.timeoutEndConnection.refresh()
                if (leaderElectionState.leaderId === player.id) {
                    resetLeaderElectionTimer()
                }
            }
            break
        }
        case 'ACK': {
            const player = game.connectedPlayersList.get(data.player.id)
            if (player) {
                player.messagesSentWithoutACK =
                    player.messagesSentWithoutACK.filter((m) => {
                        if (m.messageNum === clientMessageNum) {
                            clearTimeout(m.timeout)
                        }
                        return m.messageNum !== clientMessageNum
                    })
            }
            break
        }
        case 'PlayerReadyStartGame': {
            const connectedPlayer = game.connectedPlayersList.get(
                data.player.id
            )
            if (connectedPlayer) {
                game.connectedPlayersList.set(data.player.id, {
                    ...connectedPlayer,
                    isReady: true,
                })
            }
            ipc.send({
                type: 'push',
                name: 'changeIsReady',
                args: {
                    playerId: data.player.clientFakeId,
                    isReady: true,
                },
            })
            break
        }
        case 'PlayerCancelReadyStartGame': {
            const connectedPlayer = game.connectedPlayersList.get(
                data.player.id
            )
            if (connectedPlayer) {
                game.connectedPlayersList.set(data.player.id, {
                    ...connectedPlayer,
                    isReady: false,
                })
            }
            ipc.send({
                type: 'push',
                name: 'changeIsReady',
                args: {
                    playerId: data.player.clientFakeId,
                    isReady: false,
                },
            })
            break
        }
        case 'Action': {
            playerAction = data
            const host = Array.from(
                game.connectedPlayersList,
                ([, value]) => value
            ).find((p) => p.isHost)
            if (!host) {
                break
            }
            if (game.user.isHost) {
                game.connectedPlayersList.forEach((p) => {
                    p.actionDecision = 'null'
                })
            }

            if (data.actionType === 'draw') {
                const decision = game.validateAction({
                    player: data.player,
                    type: 'draw',
                    cardDrawn: data.cardDrawn,
                    nextPlayerTurnId: data.playerTurnId,
                })
                sendMessage(host, {
                    type: 'ActionDecision',
                    data: {
                        player: game.user,
                        doesPass: decision,
                    },
                })
            } else if (data.actionType === 'playCard') {
                const decision = game.validateAction({
                    player: data.player,
                    type: 'play',
                    card: data.cardPlayed,
                    nextPlayerTurnId: data.playerTurnId,
                    selectedColor: data.selectedColor,
                })
                sendMessage(host, {
                    type: 'ActionDecision',
                    data: {
                        player: game.user,
                        doesPass: decision,
                    },
                })
            }
            break
        }
        case 'ActionPassed': {
            if (
                data.actionType === 'draw' &&
                playerAction.actionType === 'draw'
            ) {
                const { doNextTurn, game: newGame } = game.drawCard(
                    playerAction.player.id
                )
                doNextTurn()
                ipc.send({
                    type: 'push',
                    name: 'action',
                    args: {
                        playerId: playerAction.player.clientFakeId,
                        playedCard: newGame.playedCard,
                        playerHand: playerAction.player.hand.map((c) => ({
                            id: c.id,
                            card:
                                playerAction.player.id === game.user.id
                                    ? c.card
                                    : 'back',
                        })),
                        playerTurnId: playerAction.playerTurnId,
                        selectedColor: newGame.selectedColor,
                        isVictory: playerAction.player.hand.length === 0,
                        victoriousPlayerName:
                            playerAction.player.hand.length === 0
                                ? playerAction.player.name
                                : undefined,
                    },
                })
            } else if (
                data.actionType === 'playCard' &&
                //@ts-ignore
                playerAction.actionType === 'playCard'
            ) {
                const { doNextTurn, game: newGame } = game.playCard(
                    //@ts-ignore
                    playerAction.player.id,
                    //@ts-ignore
                    playerAction.cardPlayed,
                    //@ts-ignore
                    playerAction.selectedColor
                )
                doNextTurn()
                newGame.players.forEach((p: ServerSidePlayer) => {
                    ipc.send({
                        type: 'push',
                        name: 'action',
                        args: {
                            playerId: p.clientFakeId,
                            playedCard: newGame.playedCard,
                            playerHand: p.hand.map((c) => ({
                                id: c.id,
                                card: p.id === game.user.id ? c.card : 'back',
                            })),
                            playerTurnId: playerAction.playerTurnId,
                            //@ts-ignore
                            selectedColor: playerAction.selectedColor,
                            isVictory: p.hand.length === 0,
                            victoriousPlayerName:
                                p.hand.length === 0 ? p.name : undefined,
                        },
                    })
                })
            } else {
                ipc.send({
                    type: 'push',
                    name: 'error',
                    args: {
                        type: 'abort',
                        message:
                            'Erro ao validar ação do usuário, abortando a partida.',
                    },
                })
                game.connectedPlayersList.forEach((p) => {
                    if (p.id === game.user.id) return
                    sendMessage(p, {
                        type: 'Disconnect',
                        data: { player: game.user },
                    })
                    disconnectPlayer(p)
                })
            }
            break
        }
        case 'ActionDenied': {
            if (playerAction.actionType === 'draw') {
                const decision = game.validateAction({
                    player: playerAction.player,
                    type: 'draw',
                    cardDrawn: playerAction.cardDrawn,
                    nextPlayerTurnId: playerAction.playerTurnId,
                })
                if (decision) {
                    ipc.send({
                        type: 'push',
                        name: 'error',
                        args: {
                            type: 'abort',
                            message: 'Host tentou roubar no jogo.',
                        },
                    })
                    game.connectedPlayersList.forEach((p) => {
                        if (p.id === game.user.id) return
                        sendMessage(p, {
                            type: 'Disconnect',
                            data: { player: game.user },
                        })
                        disconnectPlayer(p)
                    })
                }
                //@ts-ignore
            } else if (playerAction.actionType === 'playCard') {
                const decision = game.validateAction({
                    //@ts-ignore

                    player: playerAction.player,
                    type: 'play',
                    //@ts-ignore

                    card: playerAction.cardPlayed,
                    //@ts-ignore

                    nextPlayerTurnId: playerAction.playerTurnId,
                    //@ts-ignore

                    selectedColor: playerAction.selectedColor,
                })
                if (decision) {
                    ipc.send({
                        type: 'push',
                        name: 'error',
                        args: {
                            type: 'abort',
                            message: 'Host tentou roubar no jogo.',
                        },
                    })
                    game.connectedPlayersList.forEach((p) => {
                        if (p.id === game.user.id) return
                        sendMessage(p, {
                            type: 'Disconnect',
                            data: { player: game.user },
                        })
                        disconnectPlayer(p)
                    })
                }
            }
            break
        }
        case 'ActionDecision': {
            const player = game.connectedPlayersList.get(data.player.id)
            if (player) {
                game.connectedPlayersList.set(data.player.id, {
                    ...player,
                    actionDecision: data.doesPass ? 'pass' : 'notPass',
                })
                let didEveryoneChoose = true
                let doesPass = 0
                game.connectedPlayersList.forEach((p: ServerSidePlayer) => {
                    if (p.actionDecision === 'null') {
                        didEveryoneChoose = false
                    }
                    if (p.actionDecision === 'pass') {
                        doesPass++
                    }
                })
                if (
                    didEveryoneChoose &&
                    doesPass >= game.connectedPlayersList.size / 2
                ) {
                    game.connectedPlayersList.forEach((p: ServerSidePlayer) => {
                        if (p.id !== game.user.id) {
                            sendMessage(p, {
                                type: 'ActionPassed',
                                data: {
                                    player: game.user,

                                    actionType: playerAction.actionType,
                                    //@ts-ignore

                                    cardDrawn: playerAction.cardDrawn,
                                    //@ts-ignore

                                    playerTurnId: playerAction.playerTurnId,
                                    //@ts-ignore

                                    cardPlayed: playerAction.cardPlayed,
                                    selectedColor:
                                        //@ts-ignore

                                        playerAction.selectedColor,
                                },
                            })
                        }
                    })
                } else {
                    game.connectedPlayersList.forEach((p: ServerSidePlayer) => {
                        if (p.id !== game.user.id) {
                            sendMessage(p, {
                                type: 'ActionDenied',
                                data: {
                                    player: game.user,

                                    actionType: playerAction.actionType,
                                    playerTurnId: game.game.playerTurnId,
                                },
                            })
                        }
                    })
                }
            }
            break
        }
        case 'StartGame': {
            game.startGame(data.players, data.seed, { ...data })
            ipc.send({
                type: 'push',
                name: 'startGame',
                args: {
                    players: data.players.map((p) => ({
                        ...p,
                        hand: p.hand.map((c) => ({
                            id: c.id,
                            card: p.id === game.user.id ? c.card : 'back',
                        })),
                    })),
                    starterPlayerTurnId: data.playerTurnId,
                    starterPlayedCard: data.playedCard,
                    starterColor: data.selectedColor,
                },
            })
            break
        }
        case 'EndGame': {
            break
        }
        case 'Error': {
            break
        }
        default:
            console.log('Unknown message')
    }
    if (
        data &&
        type !== 'Error' &&
        type !== 'Connect' &&
        type !== 'Disconnect'
    ) {
        game.connectedPlayersList
            .get(data.player.id)
            ?.timeoutKeepAlive.refresh()
        game.connectedPlayersList
            .get(data.player.id)
            ?.timeoutEndConnection.refresh()
    }
}

export function onClientError(err: Error, address: string, port: number) {
    console.error(`client error:\n${err.stack}`)
    let player: ServerSidePlayer | undefined = undefined
    game.connectedPlayersList.forEach((receivingPlayer) => {
        if (
            receivingPlayer.address === address &&
            receivingPlayer.port === port
        ) {
            player = receivingPlayer
        }
    })
    if (!player) {
        return
    }
    disconnectPlayer(player)
    console.log(
        `client ${address}:${port}, name: ${
            (player as ServerSidePlayer).name
        } disconnected`
    )
}
