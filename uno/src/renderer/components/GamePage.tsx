import React, { useEffect, useRef, useState } from 'react'

type Card = { id: string; card: string }

export type Player = {
    name: string
    id: string
    hand: Card[]
    isHost: boolean
    isUser?: boolean
    isReady: boolean
}

export default function GamePage({
    onReturnToLobby,
    playerId,
    playerName,
    starterPlayerTurnId = playerId,
    onReturnHome,
    starterPlayers,
    starterIsHost,
    starterColor,
    starterPlayedCard,
}: {
    onReturnToLobby: (players: Player[]) => void
    onReturnHome: () => void
    playerId: string
    playerName: string
    starterPlayerTurnId: string
    starterPlayers: Player[]
    starterIsHost: boolean
    starterColor: string
    starterPlayedCard: Card
}) {
    const [isHost, setIsHost] = useState(starterIsHost)
    const [loading, setLoading] = useState(false)
    const [currentPlayerTurnId, setCurrentPlayerTurnId] =
        useState(starterPlayerTurnId)
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [selectedColor, setSelectedColor] = useState<string | null>(null)
    const [playedColor, setPlayedColor] = useState<string | null>(starterColor)
    const [playedCard, setPlayedCard] = useState<Card>(starterPlayedCard)
    const [selectedCard, setSelectedCard] = useState<Card | null>(null)
    const [gameResult, setGameResult] = useState<{
        type: 'victory' | 'defeat'
        winnerName: string
    } | null>(null)
    const [hand, setHand] = useState<Card[]>(
        starterPlayers.find((p) => p.isUser)?.hand || []
    )
    const [otherPlayers, setOtherPlayers] = useState<Player[]>(
        starterPlayers.filter((p) => !p.isUser)
    )
    const hasAbortedRef = useRef(false)

    const abortGame = (reason: string) => {
        if (hasAbortedRef.current) return
        hasAbortedRef.current = true
        alert('Partida abortada. Razão: ' + reason)
        onReturnHome()
    }

    function canPlayCard({ id, card }: Card): boolean {
        if (currentPlayerTurnId !== playerId) return false

        if (card === 'baralho') return true
        if ((card === 'wild' || card === 'wild4') && selectedColor) {
            return true
        }

        const cardColor = card.match(/red|blue|green|yellow/)?.[0]

        if (playedColor === cardColor) return true

        const playedValue = playedCard.card.match(
            /0|1|2|3|4|5|6|7|8|9|Plus2|Reverse|Stop/
        )?.[0]
        const cardValue = card.match(
            /0|1|2|3|4|5|6|7|8|9|Plus2|Reverse|Stop/
        )?.[0]
        if (playedValue === cardValue) return true

        return false
    }

    function onClickCard(card: Card) {
        setSelectedCard(card)
        if (card.card.startsWith('wild')) {
            setSelectedColor(null)
            setShowColorPicker(true)
        } else {
            setShowColorPicker(false)
        }
    }

    const handlePlaySelectedCard = async () => {
        if (!selectedCard) {
            return
        }
        if (!canPlayCard(selectedCard)) {
            return
        }
        setLoading(true)
        setSelectedCard(null)

        if (selectedCard.card === 'baralho') {
            const data: { playerHand: Card[]; turnPlayerID: string } =
                await send('action', {
                    type: 'draw',
                }).catch((e) => {
                    alert('Um erro aconteceu: ' + e.message)
                })
            return
        }

        const data: {
            playerHand: Card[]
            turnPlayerID: string
            isVictory: boolean
        } = await send('action', {
            type: 'playCard',
            card: selectedCard,
            selectedColor,
        }).catch((e: Error) => {
            alert('Um erro aconteceu: ' + e.message)
        })
    }

    const handleReturnToLobby = () => {
        setGameResult(null)
        setSelectedCard(null)
        setShowColorPicker(false)
        onReturnToLobby([
            {
                hand,
                id: playerId,
                isHost,
                name: playerName,
                isUser: true,
                isReady: false,
            },
            ...otherPlayers.map((p) => ({
                ...p,
                isUser: false,
                isReady: false,
            })),
        ])
    }

    useEffect(() => {
        if (gameResult) return
        if (otherPlayers.length === 0) {
            abortGame('não há mais jogadores conectados.')
        }
    }, [gameResult, otherPlayers.length])

    useEffect(() => {
        listen(
            'action',
            (
                data: {
                    playerId: string
                    playedCard: Card
                    playerHand: Card[]
                    playerTurnId: string
                    selectedColor?: string
                } & (
                    | {
                          isVictory: true
                          victoriousPlayerName: string
                      }
                    | {
                          isVictory: false
                      }
                )
            ) => {
                if (data.selectedColor) setPlayedColor(data.selectedColor)
                if (playerId === data.playerId) {
                    setLoading(false)
                    setHand(data.playerHand)
                }
                if (playerId !== data.playerId) {
                    setOtherPlayers((players) => {
                        const newPlayers = [...players]
                        newPlayers[
                            newPlayers.findIndex((p) => p.id === data.playerId)
                        ].hand = data.playerHand
                        return newPlayers
                    })
                }
                if (data.isVictory) {
                    setGameResult({
                        type:
                            playerName === data.victoriousPlayerName
                                ? 'victory'
                                : 'defeat',
                        winnerName: data.victoriousPlayerName,
                    })
                }
                setCurrentPlayerTurnId(data.playerTurnId)
                setPlayedCard(data.playedCard)
            }
        )

        listen(
            'error',
            (
                data:
                    | {
                          type: 'disconnect'
                          playerId: string
                          playerTurnId: string
                      }
                    | {
                          type: 'abort'
                          message: string
                      }
                    | {
                          type: 'error'
                          message: string
                      }
            ) => {
                if (data.type === 'disconnect') {
                    setOtherPlayers((players) => {
                        let newPlayers = [...players]
                        newPlayers = newPlayers.filter(
                            (p) => p.id !== data.playerId
                        )
                        return newPlayers
                    })
                    setCurrentPlayerTurnId(data.playerTurnId)
                }
                if (data.type === 'abort') {
                    abortGame(data.message)
                }
                if (data.type === 'error') {
                    alert('Um erro aconteceu: ' + data.message)
                }
            }
        )

        listen('changeHost', (data: { playerId: string }) => {
            if (playerId === data.playerId) setIsHost(true)
            else {
                setIsHost(false)
                setOtherPlayers((players) => {
                    const newPlayers = [...players]
                    return newPlayers.map((p) => {
                        if (p.id === data.playerId) {
                            return {
                                ...p,
                                isHost: true,
                            }
                        }
                        return {
                            ...p,
                            isHost: false,
                        }
                    })
                })
            }
        })

        return () => {
            unlisten('action')
            unlisten('error')
            unlisten('changeHost')
        }
    }, [])

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#fee2e2_35%,_#fef3c7_100%)] p-4 text-slate-900 sm:p-6">
            <div className="mx-auto flex min-h-screen max-w-7xl flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-2xl backdrop-blur">
                <header className="border-b border-white/50 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 px-6 py-4 text-white sm:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/80">
                                Partida
                            </p>
                            <h1 className="text-2xl font-black sm:text-3xl">
                                Uno
                            </h1>
                        </div>
                        <div className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
                            {currentPlayerTurnId === playerId
                                ? 'Sua Vez'
                                : `Vez de: ${otherPlayers[otherPlayers.findIndex((p) => p.id === currentPlayerTurnId)]?.name || 'Erro'}`}
                        </div>
                    </div>
                </header>

                <main className="relative flex-1 p-4 sm:p-6 lg:p-8">
                    {gameResult && (
                        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
                            <div className="w-full max-w-md rounded-[32px] border border-white/60 bg-white p-8 text-center shadow-2xl">
                                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">
                                    {gameResult.type === 'victory'
                                        ? 'Vitória'
                                        : 'Derrota'}
                                </p>
                                <h2 className="mt-3 text-3xl font-black text-slate-800">
                                    {gameResult.type === 'victory'
                                        ? 'Você venceu!'
                                        : 'Você perdeu!'}
                                </h2>
                                <p className="mt-3 text-base leading-6 text-slate-600">
                                    {gameResult.type === 'victory'
                                        ? 'Sua mão ficou vazia e a partida chegou ao fim.'
                                        : `O vencedor foi ${gameResult.winnerName}.`}
                                </p>
                                <button
                                    type="button"
                                    className="mt-6 w-full rounded-xl bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={handleReturnToLobby}
                                >
                                    Voltar para o lobby
                                </button>
                            </div>
                        </div>
                    )}
                    {otherPlayers.length === 1 ? (
                        <>
                            <div className="relative z-10 mb-4 flex flex-col items-center rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                                <h2 className="text-lg font-bold text-slate-800">
                                    {otherPlayers[0].name}
                                </h2>
                                <div className="mt-2 flex max-w-full gap-3 overflow-x-auto pb-1">
                                    {otherPlayers[0].hand.map((card, index) => (
                                        <div key={index}>
                                            <img
                                                src={'/' + card.card + '.png'}
                                                alt={card.card}
                                                className="h-24 w-16 rounded-xl object-cover shadow-md"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="relative flex min-h-[360px] flex-col justify-between lg:justify-center">
                                <div className="flex flex-col items-center justify-center gap-6 py-6">
                                    <div className="relative flex items-center justify-center gap-6 rounded-[28px] border border-slate-200 bg-slate-50/90 px-6 py-8 shadow-inner sm:px-10">
                                        <div
                                            className={`absolute top-2 text-center text-lg font-bold transition-opacity ${playedCard.card.startsWith('wild') ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                                        >
                                            {playedColor === 'red' ? (
                                                <span className="text-red-500">
                                                    Cor escolhida: Vermelho
                                                </span>
                                            ) : playedColor === 'blue' ? (
                                                <span className="text-blue-500">
                                                    Cor escolhida: Azul
                                                </span>
                                            ) : playedColor === 'green' ? (
                                                <span className="text-green-500">
                                                    Cor escolhida: Verde
                                                </span>
                                            ) : playedColor === 'yellow' ? (
                                                <span className="text-yellow-500">
                                                    Cor escolhida: Amarelo
                                                </span>
                                            ) : null}
                                        </div>

                                        <button
                                            type="button"
                                            className={`relative z-20 rounded-2xl border border-red-500 border-4 transition-all hover:scale-110 hover:z-20 disabled:cursor-not-allowed disabled:opacity-60 ${selectedCard?.card === 'baralho' ? 'scale-110 z-20' : ''}`}
                                            onClick={() =>
                                                onClickCard({
                                                    card: 'baralho',
                                                    id: 'baralho',
                                                })
                                            }
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            <img
                                                src={'/back.png'}
                                                alt={'baralho'}
                                                className="h-32 w-20 rounded-xl object-cover shadow-lg"
                                            />
                                        </button>

                                        <div>
                                            <img
                                                src={
                                                    '/' +
                                                    playedCard.card +
                                                    '.png'
                                                }
                                                alt={playedCard.card}
                                                className="h-40 w-24 rounded-2xl object-cover shadow-lg"
                                            />
                                        </div>
                                    </div>

                                    <div
                                        className={`flex flex-wrap items-center justify-center gap-3 rounded-[24px] border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition-opacity ${showColorPicker ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                                    >
                                        <button
                                            className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => {
                                                setSelectedColor('red')
                                                setShowColorPicker(false)
                                            }}
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            Vermelho
                                        </button>
                                        <button
                                            className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => {
                                                setSelectedColor('blue')
                                                setShowColorPicker(false)
                                            }}
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            Azul
                                        </button>
                                        <button
                                            className="rounded-lg bg-green-500 px-4 py-2 font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => {
                                                setSelectedColor('green')
                                                setShowColorPicker(false)
                                            }}
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            Verde
                                        </button>
                                        <button
                                            className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-white transition hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => {
                                                setSelectedColor('yellow')
                                                setShowColorPicker(false)
                                            }}
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            Amarelo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {otherPlayers[1] && (
                                <div className="relative z-10 mb-4 flex flex-col items-center rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        {otherPlayers[1].name}
                                    </h2>
                                    <div className="mt-2 flex max-w-full gap-3 overflow-x-auto pb-1">
                                        {otherPlayers[1].hand.map(
                                            (card, index) => (
                                                <div key={index}>
                                                    <img
                                                        src={
                                                            '/' +
                                                            card.card +
                                                            '.png'
                                                        }
                                                        alt={card.card}
                                                        className="h-24 w-16 rounded-xl object-cover shadow-md"
                                                    />
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="relative flex min-h-[360px] flex-col justify-between lg:justify-center">
                                {otherPlayers[0] && (
                                    <div className="absolute left-0 h-auto    top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                                        <div className="flex items-center h-auto gap-3 rounded-[24px] border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                                            <div className="flex max-h-[260px] flex-col gap-3 overflow-y-auto pr-1">
                                                {otherPlayers[0].hand.map(
                                                    (card, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex min-h-12 min-w-16 h-12 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 shadow-sm"
                                                        >
                                                            <img
                                                                src={
                                                                    '/' +
                                                                    card.card +
                                                                    '.png'
                                                                }
                                                                alt={card.card}
                                                                className="h-16 w-12 rotate-90 rounded-xl object-cover"
                                                            />
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                            <h2 className="text-sm font-bold text-slate-700">
                                                {otherPlayers[0].name}
                                            </h2>
                                        </div>
                                    </div>
                                )}

                                {otherPlayers[2] && (
                                    <div className="absolute right-0 h-auto    top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                                        <div className="flex items-center h-auto gap-3 rounded-[24px] border border-white/70 bg-white/80 p-3 shadow-sm backdrop-blur">
                                            <h2 className="text-sm font-bold text-slate-700">
                                                {otherPlayers[2].name}
                                            </h2>
                                            <div className="flex max-h-[260px]  flex-col gap-3 overflow-y-auto pr-1">
                                                {otherPlayers[2].hand.map(
                                                    (card, index) => (
                                                        <div
                                                            key={index}
                                                            className="flex min-h-12 min-w-16 h-12 w-16 items-center justify-center overflow-hidden rounded-md bg-slate-100 shadow-sm"
                                                        >
                                                            <img
                                                                src={
                                                                    '/' +
                                                                    card.card +
                                                                    '.png'
                                                                }
                                                                alt={card.card}
                                                                className="h-16 w-12 rotate-90 rounded-xl object-cover"
                                                            />
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col items-center justify-center gap-6 py-6">
                                    <div className="relative flex items-center justify-center gap-6 rounded-[28px] border border-slate-200 bg-slate-50/90 px-6 py-8 shadow-inner sm:px-10">
                                        <div
                                            className={`absolute top-2 text-center text-lg font-bold transition-opacity ${playedCard.card.startsWith('wild') ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                                        >
                                            {playedColor === 'red' ? (
                                                <span className="text-red-500">
                                                    Cor escolhida: Vermelho
                                                </span>
                                            ) : playedColor === 'blue' ? (
                                                <span className="text-blue-500">
                                                    Cor escolhida: Azul
                                                </span>
                                            ) : playedColor === 'green' ? (
                                                <span className="text-green-500">
                                                    Cor escolhida: Verde
                                                </span>
                                            ) : playedColor === 'yellow' ? (
                                                <span className="text-yellow-500">
                                                    Cor escolhida: Amarelo
                                                </span>
                                            ) : null}
                                        </div>

                                        <button
                                            type="button"
                                            className={`relative z-20 rounded-2xl border border-red-500 border-4 transition-all hover:scale-110 hover:z-20 disabled:cursor-not-allowed disabled:opacity-60 ${selectedCard?.card === 'baralho' ? 'scale-110 z-20' : ''}`}
                                            onClick={() =>
                                                onClickCard({
                                                    card: 'baralho',
                                                    id: 'baralho',
                                                })
                                            }
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            <img
                                                src={'/back.png'}
                                                alt={'baralho'}
                                                className="h-32 w-20 rounded-xl object-cover shadow-lg"
                                            />
                                        </button>

                                        <div>
                                            <img
                                                src={
                                                    '/' +
                                                    playedCard.card +
                                                    '.png'
                                                }
                                                alt={playedCard.card}
                                                className="h-40 w-24 rounded-2xl object-cover shadow-lg"
                                            />
                                        </div>
                                    </div>

                                    <div
                                        className={`flex flex-wrap items-center justify-center gap-3 rounded-[24px] border border-slate-200 bg-white/90 px-4 py-3 shadow-sm transition-opacity ${showColorPicker ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                                    >
                                        <button
                                            className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => {
                                                setSelectedColor('red')
                                                setShowColorPicker(false)
                                            }}
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            Vermelho
                                        </button>
                                        <button
                                            className="rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => {
                                                setSelectedColor('blue')
                                                setShowColorPicker(false)
                                            }}
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            Azul
                                        </button>
                                        <button
                                            className="rounded-lg bg-green-500 px-4 py-2 font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => {
                                                setSelectedColor('green')
                                                setShowColorPicker(false)
                                            }}
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            Verde
                                        </button>
                                        <button
                                            className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-white transition hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-60"
                                            onClick={() => {
                                                setSelectedColor('yellow')
                                                setShowColorPicker(false)
                                            }}
                                            disabled={
                                                loading ||
                                                currentPlayerTurnId !== playerId
                                            }
                                        >
                                            Amarelo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-lg font-bold text-slate-800">
                                Suas cartas
                            </h2>
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                                {hand.length} cartas
                            </span>
                        </div>
                        <div className="flex p-2 pb-4 justify-start items-center gap-3 overflow-x-auto max-w-[80vw] overflow-y-clip pb-1">
                            {hand.map((card, index) => (
                                <button
                                    key={card.id}
                                    className={`rounded-2xl transition-all hover:scale-110 hover:z-20 disabled:cursor-not-allowed disabled:opacity-60 ${selectedCard?.id === card.id ? 'scale-110 border-4 border-red-500 z-20' : ''}`}
                                    type="button"
                                    onClick={() => onClickCard(card)}
                                    disabled={
                                        loading ||
                                        currentPlayerTurnId !== playerId
                                    }
                                >
                                    <img
                                        src={'/' + card.card + '.png'}
                                        alt={card.card}
                                        className="min-h-40 min-w-28 h-40 w-28 rounded-[20px] object-cover shadow-lg"
                                    />
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-slate-500">
                                Selecione uma carta para jogar ou compre uma do
                                baralho.
                            </p>
                            <button
                                className={`rounded-xl px-4 py-2 text-lg font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${selectedCard?.card?.startsWith('wild') && selectedColor ? (selectedColor === 'blue' ? 'bg-blue-500' : selectedColor === 'green' ? 'bg-green-500' : selectedColor === 'yellow' ? 'bg-yellow-500' : selectedColor === 'red' ? 'bg-red-700' : 'bg-blue-500') : 'bg-red-500 hover:bg-red-600'}`}
                                type="button"
                                onClick={handlePlaySelectedCard}
                                disabled={
                                    !selectedCard ||
                                    !(
                                        canPlayCard(selectedCard) ||
                                        selectedCard.card === 'baralho'
                                    ) ||
                                    currentPlayerTurnId !== playerId ||
                                    loading
                                }
                            >
                                {loading
                                    ? 'Aguardando'
                                    : selectedCard?.card === 'baralho'
                                      ? 'Comprar carta'
                                      : 'Jogar carta'}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
