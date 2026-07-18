import type { ServerSidePlayer, Message, Card } from './types'

import ipc from './server-ipc'

import {
    SERVER_PORT,
    connections,
    connect,
    sendMessage as socketSendMessage,
} from './server'

import * as game from './game'

type SocketSendMessage = (message: string, serverId: string) => void

type PlayerAction =
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
      }

// This needs to live outside of onMessage: each incoming network message
// (Action, ActionDecision, ActionPassed, ActionDenied...) triggers a
// separate call to onMessage. If this were declared inside onMessage it
// would reset to the default value on every call, so by the time
// 'ActionPassed'/'ActionDenied' arrive the 'Action' that was recorded
// earlier would already be lost.
let playerAction: PlayerAction = {
    actionType: 'draw',
    player: game.user,
    cardDrawn: { id: '1', card: 'blue1' },
    playerTurnId: game.game.playerTurnId,
}

// When *we* are the one performing the action (not receiving it from
// someone else through onMessage), whoever triggers it locally must call
// this so the ActionDecision/ActionPassed/ActionDenied handlers below have
// the real action to work with instead of the stale default.
export function setPlayerAction(action: PlayerAction) {
    playerAction = action
}

// Applies a consensus-approved action (draw or playCard) to the local
// game state and pushes the resulting UI update to the renderer.
//
// This used to be duplicated inline in two places — the host's own
// 'Action' handler (once it decided the move was valid) and everyone
// else's 'ActionPassed' handler — but the host's copy of that logic was
// simply missing: the host broadcast ActionPassed to everyone else and
// then never applied the move to its *own* game.game, so the host's
// local state (deck/hand/playedCard/turn) silently fell out of sync every
// time someone else took a turn. Centralizing it here means both places
// behave identically.
function applyApprovedAction(action: PlayerAction) {
    if (action.actionType === 'draw') {
        const { doNextTurn, game: newGame } = game.drawCard(action.player.id)
        doNextTurn()
        // Read the drawn card back off newGame (not action.player), since
        // action.player is a snapshot taken before the draw happened and
        // never gets the new card added to its hand.
        const player = newGame.players.find((p) => p.id === action.player.id)
        ipc.send({
            type: 'push',
            name: 'action',
            args: {
                playerId: action.player.clientFakeId,
                playedCard: newGame.playedCard,
                playerHand: (player?.hand ?? []).map((c) => ({
                    id: c.id,
                    card: action.player.id === game.user.id ? c.card : 'back',
                })),
                playerTurnId: game.game.players.find(
                    (p) => p.id === game.game.playerTurnId
                )?.clientFakeId,
                selectedColor: newGame.selectedColor,
                isVictory: (player?.hand.length ?? 0) === 0,
                victoriousPlayerName:
                    (player?.hand.length ?? 0) === 0
                        ? action.player.name
                        : undefined,
            },
        })
    } else {
        const { doNextTurn, game: newGame } = game.playCard(
            action.player.id,
            action.cardPlayed,
            action.selectedColor
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
                    playerTurnId: game.game.players.find(
                        (p) => p.id === game.game.playerTurnId
                    )?.clientFakeId,
                    selectedColor: action.selectedColor,
                    isVictory: p.hand.length === 0,
                    victoriousPlayerName:
                        p.hand.length === 0 ? p.name : undefined,
                },
            })
        })
    }
}

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
    //@ts-ignore
    connectedPlayers.sort((pa, pb) => pa.id > pb.id)

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
const resendTimeoutDelay = 1000

function resendTimeoutFunction(player: ServerSidePlayer, messageNum: number) {
    return () => {
        const resendTimeout = setTimeout(
            resendTimeoutFunction,
            resendTimeoutDelay
        )
        player.messagesSentWithoutACK.forEach((m) => {
            if (m.messageNum === messageNum) {
                m.resend(resendTimeout, messageNum)
            }
        })
    }
}

function keepAliveTimeout(player: ServerSidePlayer) {
    return () =>
        sendMessage(player, {
            type: 'KeepAlive',
            data: { player: game.user },
        })
}
const keepAliveTimeoutDelay = 5000

function endConnectionTimeout(player: ServerSidePlayer) {
    return () => {
        disconnectPlayer(player)
    }
}
const endConnectionTimeoutDelay = 15000

export function sendMessage(
    player: ServerSidePlayer,
    message: Omit<Message, 'messageNum'>
) {
    console.log(player)
    const messageNum =
        player.messagesSentWithoutACK[player.messagesSentWithoutACK.length - 1]
            ?.messageNum || 0

    const resendTimeout = setTimeout(
        resendTimeoutFunction(player, messageNum),
        resendTimeoutDelay
    ) as any
    const send = (resendTimeout: number, messageNum: number) => {
        socketSendMessage(
            JSON.stringify({ ...message, messageNum: messageNum }),
            player.serverId
        )
        clearTimeout(resendTimeout)
        setTimeout(resendTimeoutFunction, resendTimeoutDelay)
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
    serverId: string,
    socketSendMessage: SocketSendMessage
) {
    const messageJSON: Message = JSON.parse(msg)
    const { data, messageNum: clientMessageNum, type } = messageJSON
    console.log(`server got a message type ${type} from ${serverId}`)

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
                data: { player: game.user },
            }),
            serverId
        )
    switch (type) {
        case 'TryConnect': {
            if (game.game.players.length < 4) {
                game.connectPlayer({ ...data.player, serverId, isUser: false })
                ensureLeader({ notify: true })
                sendMessage(
                    { ...data.player, serverId, isUser: false },
                    {
                        type: 'ConnectionAccepted',
                        data: {
                            player: game.user,
                            players: Array.from(
                                game.connectedPlayersList,
                                ([, value]) => value
                            ),
                        },
                    }
                )
                ipc.send({
                    type: 'push',
                    name: 'acceptConnect',
                    args: {
                        port: SERVER_PORT,
                        players: Array.from(
                            game.connectedPlayersList.values()
                        ).map((p) => ({
                            name: p.name,
                            hand: p.hand,
                            id: p.clientFakeId,
                            isHost: p.isHost,
                            isReady: p.isReady,
                            isUser: game.user.id === p.id,
                        })),
                    },
                })
            } else {
                sendMessage(
                    { ...data.player, serverId, isUser: false },
                    {
                        type: 'ConnectionDenied',
                        data: {
                            player: data.player,
                        },
                    }
                )
            }
            break
        }
        case 'ConnectionAccepted': {
            const host = { ...data.player }
            const kpTimeout = setTimeout(
                keepAliveTimeout(host),
                keepAliveTimeoutDelay
            ) as any
            host.timeoutKeepAlive = kpTimeout
            const endTimeout = setTimeout(
                endConnectionTimeout(host),
                endConnectionTimeoutDelay
            ) as any
            host.timeoutEndConnection = endTimeout
            game.connectPlayer({
                ...host,
                serverId,
                isUser: false,
            })
            data.players.forEach((p: ServerSidePlayer) => {
                if (data.player.id === p.id || p.id === game.user.id) return
                connect(p.port, p.address).then(
                    ([success, playerServerId]: any) => {
                        if (!success) return
                        const player = { ...p }
                        const kpTimeout = setTimeout(
                            keepAliveTimeout(player),
                            keepAliveTimeoutDelay
                        ) as any
                        player.timeoutKeepAlive = kpTimeout
                        const endTimeout = setTimeout(
                            endConnectionTimeout(player),
                            endConnectionTimeoutDelay
                        ) as any
                        player.timeoutEndConnection = endTimeout
                        game.connectPlayer({
                            ...player,
                            serverId: playerServerId,
                            isUser: false,
                        })
                        sendMessage(
                            {
                                ...player,
                                serverId: playerServerId,
                                isUser: false,
                            },
                            {
                                type: 'Connect',
                                data: { player: game.user },
                            }
                        )
                    }
                )
            })
            ipc.send({
                type: 'push',
                name: 'acceptConnect',
                args: {
                    port: SERVER_PORT,
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
            const player = { ...data.player }
            const kpTimeout = setTimeout(
                keepAliveTimeout(player),
                keepAliveTimeoutDelay
            ) as any
            player.timeoutKeepAlive = kpTimeout
            const endTimeout = setTimeout(
                endConnectionTimeout(player),
                endConnectionTimeoutDelay
            ) as any
            player.timeoutEndConnection = endTimeout
            game.connectPlayer({
                ...player,
                serverId,
                isUser: false,
            })
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
                clearTimeout(player.timeoutKeepAlive)
                const kpTimeout = setTimeout(
                    keepAliveTimeout(player),
                    keepAliveTimeoutDelay
                ) as any
                player.timeoutKeepAlive = kpTimeout
                clearTimeout(player.timeoutEndConnection)
                const endTimeout = setTimeout(
                    endConnectionTimeout(player),
                    endConnectionTimeoutDelay
                ) as any
                player.timeoutEndConnection = endTimeout
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
                if (data.actionType === 'draw') {
                    const decision = game.validateAction({
                        player: data.player,
                        type: 'draw',
                        cardDrawn: data.cardDrawn,
                        nextPlayerTurnId: data.playerTurnId,
                    })
                    game.user.actionDecision = decision ? 'pass' : 'notPass'
                } else if (data.actionType === 'playCard') {
                    const decision = game.validateAction({
                        player: data.player,
                        type: 'play',
                        card: data.cardPlayed,
                        nextPlayerTurnId: data.playerTurnId,
                        selectedColor: data.selectedColor,
                    })
                    game.user.actionDecision = decision ? 'pass' : 'notPass'
                }
                const player = game.connectedPlayersList.get(data.player.id)
                if (player) {
                    game.connectedPlayersList.set(data.player.id, {
                        ...player,
                        actionDecision: 'pass',
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
                        game.connectedPlayersList.forEach(
                            (p: ServerSidePlayer) => {
                                if (p.id !== game.user.id) {
                                    sendMessage(p, {
                                        type: 'ActionPassed',
                                        data: {
                                            player: game.user,

                                            actionType: playerAction.actionType,
                                            //@ts-ignore

                                            cardDrawn: playerAction.cardDrawn,
                                            //@ts-ignore

                                            playerTurnId:
                                                playerAction.playerTurnId,
                                            //@ts-ignore

                                            cardPlayed: playerAction.cardPlayed,
                                            selectedColor:
                                                //@ts-ignore

                                                playerAction.selectedColor,
                                        },
                                    })
                                }
                            }
                        )
                        // The host approved the action for everyone else —
                        // it also needs to apply it to its own local state,
                        // which nothing else here was doing.
                        applyApprovedAction(playerAction)
                    } else {
                        game.connectedPlayersList.forEach(
                            (p: ServerSidePlayer) => {
                                if (p.id !== game.user.id) {
                                    sendMessage(p, {
                                        type: 'ActionDenied',
                                        data: {
                                            player: game.user,

                                            actionType: playerAction.actionType,
                                            playerTurnId:
                                                game.game.playerTurnId,
                                        },
                                    })
                                }
                            }
                        )
                    }
                }
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
                (data.actionType === 'draw' &&
                    playerAction.actionType === 'draw') ||
                (data.actionType === 'playCard' &&
                    //@ts-ignore
                    playerAction.actionType === 'playCard')
            ) {
                applyApprovedAction(playerAction)
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
                    // Same gap as in case 'Action': this path runs when the
                    // HOST itself is the one who performed the move (guests
                    // vote back via ActionDecision, host tallies here).
                    // Without this call the host approves everyone else's
                    // view of the action but never applies it to its own
                    // game.game, so the host's own hand/deck/pile silently
                    // stop matching everyone else's.
                    applyApprovedAction(playerAction)
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
            console.log(data.players)
            ipc.send({
                type: 'push',
                name: 'startGame',
                args: {
                    players: data.players.map((p) => ({
                        id: p.clientFakeId,
                        isHost: p.isHost,
                        isReady: p.isReady,
                        name: p.name,
                        isUser: game.user.id === p.id,
                        hand: p.hand.map((c) => ({
                            id: c.id,
                            card: p.id === game.user.id ? c.card : 'back',
                        })),
                    })),
                    starterPlayerTurnId:
                        game.game.players.find(
                            (p) => p.id === data.playerTurnId
                        )?.clientFakeId || '',
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
        const player = game.connectedPlayersList.get(data.player.id)
        if (player) {
            clearTimeout(player.timeoutKeepAlive)
            const kpTimeout = setTimeout(
                keepAliveTimeout(player),
                keepAliveTimeoutDelay
            ) as any
            player.timeoutKeepAlive = kpTimeout
            clearTimeout(player.timeoutEndConnection)
            const endTimeout = setTimeout(
                endConnectionTimeout(player),
                endConnectionTimeoutDelay
            ) as any
            player.timeoutEndConnection = endTimeout
        }
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