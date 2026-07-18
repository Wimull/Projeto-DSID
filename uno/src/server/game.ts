import type { Card, Game, ServerSidePlayer } from './types'

// eslint-disable-next-line import/no-unresolved
import { v4 as uuid } from 'uuid'

// Gerador de numeros aleatorios de 0 a 1 com seed
export function mulberry32(a: number) {
    return function () {
        let t = (a += 0x6d2b79f5)
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export const user: ServerSidePlayer = {
    actionDecision: 'null',
    address: '',
    serverId: '',
    clientFakeId: '',
    hand: [],
    id: '',
    isHost: false,
    isReady: false,
    messagesSentWithoutACK: [],
    name: '',
    port: 0,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    timeoutKeepAlive: setTimeout(() => undefined) as any,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    timeoutEndConnection: setTimeout(() => undefined) as any,
    isUser: true,
}
const normalDeck = [
    'blue0',
    'blue1',
    'blue1',
    'blue2',
    'blue2',
    'blue3',
    'blue3',
    'blue4',
    'blue4',
    'blue5',
    'blue5',
    'blue6',
    'blue6',
    'blue7',
    'blue7',
    'blue8',
    'blue8',
    'blue9',
    'blue9',
    'blueStop',
    'blueStop',
    'blueReverse',
    'blueReverse',
    'bluePlus2',
    'bluePlus2',

    'green0',
    'green1',
    'green1',
    'green2',
    'green2',
    'green3',
    'green3',
    'green4',
    'green4',
    'green5',
    'green5',
    'green6',
    'green6',
    'green7',
    'green7',
    'green8',
    'green8',
    'green9',
    'green9',
    'greenStop',
    'greenStop',
    'greenReverse',
    'greenReverse',
    'greenPlus2',
    'greenPlus2',

    'red0',
    'red1',
    'red1',
    'red2',
    'red2',
    'red3',
    'red3',
    'red4',
    'red4',
    'red5',
    'red5',
    'red6',
    'red6',
    'red7',
    'red7',
    'red8',
    'red8',
    'red9',
    'red9',
    'redStop',
    'redStop',
    'redReverse',
    'redReverse',
    'redPlus2',
    'redPlus2',

    'yellow0',
    'yellow1',
    'yellow1',
    'yellow2',
    'yellow2',
    'yellow3',
    'yellow3',
    'yellow4',
    'yellow4',
    'yellow5',
    'yellow5',
    'yellow6',
    'yellow6',
    'yellow7',
    'yellow7',
    'yellow8',
    'yellow8',
    'yellow9',
    'yellow9',
    'yellowStop',
    'yellowStop',
    'yellowReverse',
    'yellowReverse',
    'yellowPlus2',
    'yellowPlus2',

    'wild',
    'wild',
    'wild',
    'wild',
    'wild4',
    'wild4',
    'wild4',
    'wild4',
]

export let game: Game = {
    deck: [],
    players: [],
    playedCard: {
        id: '',
        card: '',
    },
    selectedColor: 'blue',
    playerTurnId: '',
    playOrder: 'up',
    seed: 0,
    random: () => {
        return 0
    },
}

export const connectedPlayersList: Map<string, ServerSidePlayer> = new Map([])

export function connectPlayer(player: ServerSidePlayer) {
    connectedPlayersList.set(player.id, player)
}

export function disconnectPlayer(playerId: string) {
    connectedPlayersList.delete(playerId)
    if (game.players.length > 0) {
        const player =
            game.players[game.players.findIndex((p) => p.id === playerId)]
        if (game.playerTurnId === playerId) {
            // goNextTurn needs the leaving player still in the array to
            // compute their index, so this must run before removing them.
            goNextTurn({ newGame: game })
        }
        // Same issue as in playCard: .filter() doesn't mutate in place, the
        // result has to be assigned back or the player never actually
        // leaves the game.
        game.players = game.players.filter((p) => p.id !== playerId)
        return game
    }
}

export function startGame(
    players: ServerSidePlayer[],
    seed: number,
    starterGame?: Game
) {
    if (starterGame) {
        game = starterGame
        game.random = mulberry32(game.seed)
        game.players = game.players.map((p) => ({
            ...p,
            isUser: p.id === user.id,
        }))
        game.players.forEach((p) => {
            connectedPlayersList.set(p.id, {
                ...connectedPlayersList.get(p.id)!,
                hand: p.hand,
            })
        })
        return game
    }

    game.seed = seed
    game.random = mulberry32(game.seed)
    let deck = [...normalDeck]
    while (deck[deck.length - 1].startsWith('wild')) {
        deck = deck.sort((a, b) => 0.5 - game.random())
    }
    game.deck = deck.map((card) => ({
        id: uuid(),
        card,
    }))
    game.playedCard = game.deck.pop()!
    game.selectedColor = game.playedCard.card.startsWith('blue')
        ? 'blue'
        : game.playedCard.card.startsWith('green')
          ? 'green'
          : game.playedCard.card.startsWith('yellow')
            ? 'yellow'
            : 'red'
    game.players = players.map((p) => {
        p.hand = []
        for (let i = 0; i < 7; i++) {
            p.hand.push(game.deck.pop()!)
        }
        return p
    })
    game.players = game.players.map((p) => ({
        ...p,
        isUser: p.id === user.id,
    }))
    game.playerTurnId =
        players[Math.round(Math.random() * 10) % players.length].id
    game.playOrder = 'up'
    game.players.forEach((p) => {
        connectedPlayersList.set(p.id, {
            ...connectedPlayersList.get(p.id)!,
            hand: p.hand,
        })
    })
    return game
}
export function goNextTurn({
    newGame,
    skipNumber = 0,
    playerTurnId,
}: {
    newGame: Game
    skipNumber?: number
    playerTurnId?: string
}) {
    console.trace('goNextTurn')
    console.log(newGame, playerTurnId)
    const index = newGame.players.findIndex(
        (p) => p.id === newGame.playerTurnId
    )
    newGame.playerTurnId =
        playerTurnId ||
        newGame.players[
            Math.abs(
                (newGame.playOrder === 'up'
                    ? index + 1 + skipNumber
                    : index - (1 + skipNumber)) % newGame.players.length
            )
        ]!.id
    game = newGame
    game.players.forEach((p) => {
        connectedPlayersList.set(p.id, {
            ...connectedPlayersList.get(p.id)!,
            hand: p.hand,
        })
    })
}

export function drawFromDeck(newGame: Game) {
    console.trace('Draw')
    if (newGame.deck.length === 0) {
        let hasCardPlayedTakenOut = false
        newGame.deck = normalDeck
            .map((v) => {
                if (v === newGame.playedCard.card && !hasCardPlayedTakenOut) {
                    hasCardPlayedTakenOut = true
                    return false
                }
                return {
                    card: v,
                    id: uuid(),
                }
            })
            .filter((v) => v)
            .sort((a, b) => 0.5 - newGame.random()) as Card[]
    }
    const card = newGame.deck.pop()!
    return card
}

export function playCard(
    playerId: string,
    { card, id: cardId }: Card,
    selectedColor?: 'blue' | 'red' | 'green' | 'yellow'
) {
    const newGame: Game = {
        deck: game.deck.map((c) => ({ ...c })),
        playedCard: { ...game.playedCard },
        players: game.players.map((p) => ({
            ...p,
            hand: p.hand.map((c) => ({ ...c })),
        })),
        playerTurnId: game.playerTurnId,
        playOrder: game.playOrder,
        selectedColor: game.selectedColor,
        random: game.random,
        seed: game.seed,
    }
    console.log('playCard', playerId, {
        ...newGame,
        players: newGame.players.map((p) => ({ ...p, hand: [...p.hand] })),
    })
    const index = newGame.players.findIndex(
        (p) => p.id === newGame.playerTurnId
    )
    let nextPlayerTurnId =
        newGame.players[
            Math.abs(
                (newGame.playOrder === 'up' ? index + 1 + 0 : index - (1 + 0)) %
                    newGame.players.length
            )
        ]!.id
    const player =
        newGame.players[newGame.players.findIndex((p) => p.id === playerId)]
    // .filter() returns a new array — it doesn't mutate player.hand. The
    // previous code called it and threw the result away, so the played
    // card was never actually removed from the player's hand.
    player.hand = player.hand.filter((c) => c.id !== cardId)
    // The played card was only ever copied from the *previous* playedCard
    // (see newGame.playedCard above) and never updated to the card that
    // was just played, so the pile visually never changed.
    newGame.playedCard = { id: cardId, card }
    newGame.selectedColor = card.includes('blue')
        ? 'blue'
        : card.includes('green')
          ? 'green'
          : card.includes('yellow')
            ? 'yellow'
            : card.includes('red')
              ? 'red'
              : selectedColor || 'blue'
    if (card.includes('Plus2')) {
        const playerToDraw =
            newGame.players[
                Math.abs(
                    (newGame.playOrder === 'up' ? index + 1 : index - 1) %
                        newGame.players.length
                )
            ]
        for (let i = 0; i < 2; i++) {
            playerToDraw.hand.push(drawFromDeck(newGame))
        }
        nextPlayerTurnId =
            newGame.players[
                Math.abs(
                    (newGame.playOrder === 'up'
                        ? index + 1 + 1
                        : index - (1 + 1)) % newGame.players.length
                )
            ]!.id
        return {
            game: newGame,
            doNextTurn: (playerTurnId?: string) =>
                goNextTurn({ newGame, skipNumber: 1, playerTurnId }),
            nextPlayerTurnId,
        }
    } else if (card.includes('wild4')) {
        const index = newGame.players.findIndex(
            (p) => p.id === newGame.playerTurnId
        )
        const playerToDraw =
            newGame.players[
                Math.abs(
                    (newGame.playOrder === 'up' ? index + 1 : index - 1) %
                        newGame.players.length
                )
            ]
        for (let i = 0; i < 4; i++) {
            playerToDraw.hand.push(drawFromDeck(newGame))
        }
        nextPlayerTurnId =
            newGame.players[
                Math.abs(
                    (newGame.playOrder === 'up'
                        ? index + 1 + 1
                        : index - (1 + 1)) % newGame.players.length
                )
            ]!.id
        return {
            game: newGame,
            doNextTurn: (playerTurnId?: string) =>
                goNextTurn({ newGame, skipNumber: 1, playerTurnId }),
            nextPlayerTurnId,
        }
    } else if (card.includes('Stop')) {
        nextPlayerTurnId =
            newGame.players[
                Math.abs(
                    (newGame.playOrder === 'up'
                        ? index + 1 + 1
                        : index - (1 + 1)) % newGame.players.length
                )
            ]!.id
        return {
            game: newGame,
            doNextTurn: (playerTurnId?: string) =>
                goNextTurn({ newGame, skipNumber: 1, playerTurnId }),
            nextPlayerTurnId,
        }
    } else if (card.includes('Reverse')) {
        newGame.playOrder = newGame.playOrder === 'up' ? 'down' : 'up'

        nextPlayerTurnId =
            newGame.players[
                Math.abs(
                    (newGame.playOrder === 'up'
                        ? index - (1 + 0)
                        : index + 1 + 0) % newGame.players.length
                )
            ]!.id
        return {
            game: newGame,
            doNextTurn: (playerTurnId?: string) =>
                goNextTurn({ newGame, playerTurnId }),
            nextPlayerTurnId,
        }
    } else {
        return {
            game: newGame,
            doNextTurn: (playerTurnId?: string) =>
                goNextTurn({ newGame, playerTurnId }),
            nextPlayerTurnId,
        }
    }
}

export function drawCard(playerId: string) {
    const newGame: Game = {
        deck: game.deck.map((c) => ({ ...c })),
        playedCard: { ...game.playedCard },
        players: game.players.map((p) => ({
            ...p,
            hand: p.hand.map((c) => ({ ...c })),
        })),
        playerTurnId: game.playerTurnId,
        playOrder: game.playOrder,
        selectedColor: game.selectedColor,
        random: game.random,
        seed: game.seed,
    }
    console.log('drawCard', playerId, {
        ...newGame,
        players: newGame.players.map((p) => ({ ...p, hand: [...p.hand] })),
    })
    const player =
        newGame.players[newGame.players.findIndex((p) => p.id === playerId)]
    const newPlayer = {
        ...player,
        hand: player.hand.map((c) => ({ ...c })),
    }
    const cardDrawn = drawFromDeck(newGame)
    newPlayer.hand.push(cardDrawn)
    const index = newGame.players.findIndex((p) => p.id === playerId)
    newGame.players[index].hand = newPlayer.hand
    const nextPlayerTurnId =
        newGame.players[
            Math.abs(
                (newGame.playOrder === 'up' ? index + 1 + 0 : index - (1 + 0)) %
                    newGame.players.length
            )
        ]!.id
    return {
        cardDrawn,
        game: newGame,
        doNextTurn: (playerTurnId?: string) =>
            goNextTurn({ newGame, playerTurnId }),
        nextPlayerTurnId,
    }
}

export function validateAction(
    action:
        | {
              type: 'draw'
              player: ServerSidePlayer
              cardDrawn: Card
              nextPlayerTurnId: string
          }
        | {
              type: 'play'
              player: ServerSidePlayer
              selectedColor?: 'blue' | 'green' | 'red' | 'yellow'
              nextPlayerTurnId: string
              card: Card
          }
) {
    console.trace('validateAction')
    console.log(action, { ...game, players: [...game.players] })
    const index = game.players.findIndex((p) => p.id === game.playerTurnId)
    if (action.nextPlayerTurnId)
        if (action.type === 'draw') {
            console.log(action.cardDrawn, [...game.deck])
            if (
                action.cardDrawn.id === game.deck[game.deck.length - 1].id &&
                action.cardDrawn.card === game.deck[game.deck.length - 1].card
            ) {
                const nextTurnId =
                    game.players[
                        Math.abs(
                            (game.playOrder === 'up' ? index + 1 : index - 1) %
                                game.players.length
                        )
                    ].id
                console.log(
                    'validate: ',
                    nextTurnId,
                    action.nextPlayerTurnId,
                    nextTurnId === action.nextPlayerTurnId
                )
                return nextTurnId === action.nextPlayerTurnId ? true : false
            }
            return false
        } else {
            const player =
                game.players[
                    game.players.findIndex((p) => p.id === action.player.id)
                ]
            const cardIndex = player.hand.findIndex(
                (c) => c.id === action.card.id
            )
            console.log(
                cardIndex,
                player.hand[cardIndex].card,
                action.card.card
            )
            if (
                cardIndex !== -1 &&
                player.hand[cardIndex].card === action.card.card
            ) {
                let order = game.playOrder
                if (action.card.card.includes('Reverse'))
                    order = game.playOrder === 'up' ? 'down' : 'up'
                let nextPlayerTurnId =
                    game.players[
                        Math.abs(
                            (order === 'up' ? index + 1 : index - 1) %
                                game.players.length
                        )
                    ].id
                if (
                    player.hand[cardIndex].card.includes('wild4') ||
                    player.hand[cardIndex].card.includes('Stop') ||
                    player.hand[cardIndex].card.includes('Plus2')
                ) {
                    nextPlayerTurnId =
                        game.players[
                            Math.abs(
                                (game.playOrder === 'up'
                                    ? index + 1 + 1
                                    : index - (1 + 1)) % game.players.length
                            )
                        ]!.id
                }
                console.log(
                    'validate: ',
                    nextPlayerTurnId,
                    action.nextPlayerTurnId,
                    nextPlayerTurnId === action.nextPlayerTurnId
                )
                return nextPlayerTurnId === action.nextPlayerTurnId
            }
            return false
        }
}
