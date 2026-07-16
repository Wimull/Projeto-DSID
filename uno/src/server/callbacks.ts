import type { ServerSidePlayer, Player, Game, Message, Card } from './types'

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

function sendMessage(
    player: ServerSidePlayer,
    message: Omit<Message, 'messageNum'>,
    socketSendMessage: SocketSendMessage
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

function disconnectPlayer(player: ServerSidePlayer) {
    clearTimeout(player.timeoutKeepAlive)
    clearTimeout(player.timeoutEndConnection)
    player.messagesSentWithoutACK.forEach((m) => clearTimeout(m.timeout))
    game.disconnectPlayer(player.id)
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

    const keepAliveRes: Partial<Message> = {
        type: 'KeepAlive',
        data: {
            player: game.user,
        },
    }

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
                sendMessage(
                    data.player,
                    {
                        type: 'ConnectionAccepted',
                        data: {
                            player: game.user,
                            players: Array.from(
                                game.connectedPlayersList,
                                ([k, v]) => v
                            ),
                        },
                    },
                    socketSendMessage
                )
            } else {
                sendMessage(
                    data.player,
                    {
                        type: 'ConnectionDenied',
                        data: {
                            player: data.player,
                        },
                    },
                    socketSendMessage
                )
            }
            break
        }
        case 'ConnectionAccepted': {
            data.players.forEach((p: ServerSidePlayer) => {
                connect(p.port, p.address).then(() => {
                    sendMessage(
                        p,
                        { type: 'Connect', data: { player: game.user } },
                        socketSendMessage
                    )
                    ipc.send({
                        type: 'push',
                        name: 'acceptConnect',
                        args: {
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
            if (game.connectedPlayersList.has(data.player.id)) {
                game.connectedPlayersList.set(data.player.id, {
                    ...game.connectedPlayersList.get(data.player.id)!,
                    isReady: true,
                })
                ipc.send({
                    type: 'push',
                    name: 'changeIsReady',
                    args: {
                        playerId: data.player.clientFakeId,
                        isReady: true,
                    },
                })
            }
            break
        }
        case 'PlayerCancelReadyStartGame': {
            if (game.connectedPlayersList.has(data.player.id)) {
                game.connectedPlayersList.set(data.player.id, {
                    ...game.connectedPlayersList.get(data.player.id)!,
                    isReady: false,
                })
                ipc.send({
                    type: 'push',
                    name: 'changeIsReady',
                    args: {
                        playerId: data.player.clientFakeId,
                        isReady: false,
                    },
                })
            }
            break
        }
        case 'Action': {
            playerAction = data
            const host = Array.from(
                game.connectedPlayersList,
                ([key, value]) => value
            ).find((p) => p.isHost)!
            if (data.actionType === 'draw') {
                const decision = game.validateAction({
                    player: data.player,
                    type: 'draw',
                    cardDrawn: data.cardDrawn,
                    nextPlayerTurnId: data.playerTurnId,
                })
                sendMessage(
                    host,
                    {
                        type: 'ActionDecision',
                        data: {
                            player: game.user,
                            doesPass: decision,
                        },
                    },
                    socketSendMessage
                )
            } else if (data.actionType === 'playCard') {
                const decision = game.validateAction({
                    player: data.player,
                    type: 'play',
                    card: data.cardPlayed,
                    nextPlayerTurnId: data.playerTurnId,
                    selectedColor: data.selectedColor,
                })
                sendMessage(
                    host,
                    {
                        type: 'ActionDecision',
                        data: {
                            player: game.user,
                            doesPass: decision,
                        },
                    },
                    socketSendMessage
                )
            }
            break
        }
        case 'ActionPassed': {
            if (
                data.actionType === 'draw' &&
                playerAction.actionType === 'draw'
            ) {
                const {
                    doNextTurn,
                    cardDrawn,
                    game: newGame,
                } = game.drawCard(playerAction.player.id)
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
                    sendMessage(
                        p,
                        { type: 'Disconnect', data: { player: game.user } },
                        socketSendMessage
                    )
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
                    // TODO Tentar reeleição do Host
                    ipc.send({
                        type: 'push',
                        name: 'error',
                        args: {
                            type: 'abort',
                            message: 'Host tentou roubar no jogo.',
                        },
                    })
                    game.connectedPlayersList.forEach((p) => {
                        sendMessage(
                            p,
                            { type: 'Disconnect', data: { player: game.user } },
                            socketSendMessage
                        )
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
                    // TODO Tentar reeleição do Host
                    ipc.send({
                        type: 'push',
                        name: 'error',
                        args: {
                            type: 'abort',
                            message: 'Host tentou roubar no jogo.',
                        },
                    })
                    game.connectedPlayersList.forEach((p) => {
                        sendMessage(
                            p,
                            { type: 'Disconnect', data: { player: game.user } },
                            socketSendMessage
                        )
                        disconnectPlayer(p)
                    })
                }
            }
            break
        }
        case 'ActionDecision': {
            if (game.connectedPlayersList.has(data.player.id)) {
                const player = game.connectedPlayersList.get(data.player.id)!
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
                            sendMessage(
                                p,
                                {
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
                                },
                                socketSendMessage
                            )
                        }
                    })
                } else {
                    game.connectedPlayersList.forEach((p: ServerSidePlayer) => {
                        if (p.id !== game.user.id) {
                            sendMessage(
                                p,
                                {
                                    type: 'ActionDenied',
                                    data: {
                                        player: game.user,

                                        actionType: playerAction.actionType,
                                        playerTurnId: game.game.playerTurnId,
                                    },
                                },
                                socketSendMessage
                            )
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

export function onClientError(
    err: Error,
    address: string,
    port: number,
    socketSendMessage: SocketSendMessage
) {
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
