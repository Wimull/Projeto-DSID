import React, { useEffect, useMemo, useState } from 'react'
import { type Player } from './GamePage'

const cardAssets = ['/red0.png', '/blue0.png', '/yellow0.png', '/green0.png']
type LobbyPageProps = {
    onBackToHome: () => void
    onStartGame: (
        players: Player[],
        starterPlayerTurnId: string,
        starterColor: string,
        starterPlayedCard: string
    ) => void
    createdLobby: boolean
    starterPlayers: Player[]
    starterPlayerName: string
    starterPlayerId: string
    lobbyIP: string
    starterHasJoined: boolean
    port: string
    onPortChange: (v: string) => void
}

export default function LobbyPage({
    onBackToHome,
    onStartGame,
    createdLobby,
    starterPlayers,
    lobbyIP,
    starterPlayerId,
    starterPlayerName,
    starterHasJoined,
    port,
    onPortChange,
}: LobbyPageProps) {
    const [loading, setLoading] = useState(false)
    const [playerName, setPlayerName] = useState(starterPlayerName)
    const [playerId, setPlayerId] = useState(starterPlayerId)
    const [hasJoined, setHasJoined] = useState(starterHasJoined)
    const [isReady, setIsReady] = useState(false)
    const [connectedPlayers, setConnectedPlayers] =
        useState<Player[]>(starterPlayers)

    const allPlayersReady =
        connectedPlayers.length > 0 &&
        connectedPlayers.every((player) => player.isReady)
    const isHost =
        connectedPlayers[connectedPlayers.findIndex((p) => p.isUser)]?.isHost ??
        createdLobby

    const handleStartGame = async () => {
        setLoading(true)
        const data: {
            players: Player[]
            starterPlayerTurnId: string
            starterPlayedCard: string
            starterColor: string
        } = await send('startGame', {}).catch((e) => {
            alert('Um erro aconteceu ao tentar iniciar o jogo: ' + e.message)
            setLoading(false)
        })
        setLoading(false)
        onStartGame(
            data.players,
            data.starterPlayerTurnId,
            data.starterColor,
            data.starterPlayedCard
        )
    }

    const handleChangeIsReady = async () => {
        setLoading(true)
        const data: { isReady: boolean } = await send('changeIsReady', {
            isReady,
        }).catch((e) => {
            alert('Um erro aconteceu: ' + e.message)
            setLoading(false)
        })
        setLoading(false)
        setIsReady(data.isReady)
    }

    const handleContinue = async () => {
        if (playerName.trim()) {
            setHasJoined(true)
        }
        setLoading(true)
        if (createdLobby) {
            const data: {
                playerId: string
                port: string
            } = await send('createLobby', { playerName }).catch((e) => {
                alert('Um erro aconteceu ao tentar criar a sala: ' + e.message)
                setLoading(false)
            })
            onPortChange(data.port)
            setConnectedPlayers([
                {
                    name: playerName,
                    id: data.playerId,
                    hand: [],
                    isHost: true,
                    isUser: true,
                    isReady: false,
                },
            ])
            setLoading(false)
        } else {
            const data: any = await send('connectToLobby', {
                ip: lobbyIP,
                playerName,
            }).catch((e) => {
                alert(
                    'Um erro aconteceu ao tentar entrar no lobby: ' + e.message
                )
                setLoading(false)
            })
        }
    }

    useEffect(() => {
        listen('acceptConnect', (data: { players: Player[]; port: string }) => {
            setConnectedPlayers(data.players)
            onPortChange(data.port)
            setLoading(false)
        })

        listen(
            'startGame',
            (data: {
                players: Player[]
                starterPlayerTurnId: string
                starterPlayedCard: string
                starterColor: string
            }) =>
                onStartGame(
                    data.players,
                    data.starterPlayerTurnId,
                    data.starterColor,
                    data.starterPlayedCard
                )
        )
        listen(
            'changeIsReady',
            (data: { playerId: string; isReady: boolean }) => {
                setConnectedPlayers((players) => {
                    const newPlayers = [...players]
                    newPlayers[
                        newPlayers.findIndex((p) => p.id === data.playerId)
                    ]!.isReady = data.isReady
                    return newPlayers
                })
            }
        )
        listen('connect', (data: { playerId: string; playerName: string }) => {
            setConnectedPlayers((players) => {
                const newPlayers = [...players]
                newPlayers.push({
                    name: data.playerName,
                    id: data.playerId,
                    hand: [],
                    isHost: false,
                    isUser: false,
                    isReady: false,
                })
                return newPlayers
            })
        })

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
                    | {
                          type: 'cantConnect'
                          message: string
                      }
            ) => {
                if (data.type === 'cantConnect') {
                    alert(
                        'Um erro aconteceu ao tentar entrar no lobby: ' +
                            data.message
                    )
                    setLoading(false)
                }
                if (data.type === 'disconnect') {
                    setConnectedPlayers((players) => {
                        let newPlayers = [...players]
                        newPlayers = newPlayers.filter(
                            (p) => p.id !== data.playerId
                        )
                        return newPlayers
                    })
                }
                if (data.type === 'abort') {
                    alert('Partida abortada. Razão: ' + data.message)
                    onBackToHome()
                }
                if (data.type === 'error') {
                    alert('Um erro aconteceu: ' + data.message)
                }
            }
        )

        listen('changeHost', (data: { playerId: string }) => {
            setConnectedPlayers((players) => {
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
        })

        return () => {
            unlisten('startGame')
            unlisten('changeIsReady')
            unlisten('connect')
            unlisten('error')
            unlisten('changeHost')
        }
    }, [])

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#fee2e2_35%,_#fef3c7_100%)] p-4 text-slate-900 sm:p-6">
            <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center">
                <div className="w-full overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-2xl backdrop-blur">
                    <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-red-600 via-orange-500 to-amber-400 p-8 text-white sm:p-10">
                            <div
                                className="absolute inset-0 opacity-20"
                                style={{
                                    backgroundImage: 'url(/back.png)',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                            <div className="relative">
                                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-white/80">
                                    Sala do lobby
                                </p>
                                <h1 className="mt-3 text-5xl font-black sm:text-6xl">
                                    Uno
                                </h1>
                                <p className="mt-4 max-w-md text-lg text-white/90">
                                    Digite seu nome, espere seus amigos e inicie
                                    a partida.
                                </p>
                            </div>

                            <div className="relative mt-8 flex flex-wrap gap-3">
                                {cardAssets.map((asset, index) => (
                                    <img
                                        key={asset}
                                        src={asset}
                                        alt=""
                                        className={`h-16 w-12 rounded-lg object-cover shadow-lg ${index % 2 === 0 ? 'rotate-[-6deg]' : 'rotate-[6deg]'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col justify-center bg-slate-50 p-8 sm:p-10">
                            {!hasJoined ? (
                                <div className="space-y-5">
                                    <div>
                                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-500">
                                            Configuração do jogador
                                        </p>
                                        <h2 className="mt-2 text-3xl font-bold text-slate-800">
                                            Escolha seu nome
                                        </h2>
                                    </div>

                                    <div className="space-y-2">
                                        <label
                                            htmlFor="player-name"
                                            className="text-sm font-medium text-slate-700"
                                        >
                                            Seu nome
                                        </label>
                                        <input
                                            id="player-name"
                                            type="text"
                                            value={playerName}
                                            onChange={(event) =>
                                                setPlayerName(
                                                    event.target.value
                                                )
                                            }
                                            placeholder="Player 1"
                                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-200"
                                        />
                                        <p className="text-sm text-slate-500">
                                            Isso aparecerá no lobby quando você
                                            entrar.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="w-full rounded-xl bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-600"
                                        onClick={handleContinue}
                                        disabled={loading}
                                    >
                                        {loading ? 'Aguardando' : 'Continuar'}
                                    </button>

                                    <button
                                        type="button"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
                                        onClick={onBackToHome}
                                        disabled={loading}
                                    >
                                        {loading
                                            ? 'Aguardando'
                                            : 'Voltar para a tela inicial'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div>
                                        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-500">
                                            Jogadores conectados
                                        </p>
                                        <h2 className="mt-2 text-3xl font-bold text-slate-800">
                                            {playerName.trim() || 'Jogador'}{' '}
                                            está no lobby
                                        </h2>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        {isHost && port && (
                                            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                                                <p className="text-sm font-semibold text-amber-700">
                                                    Porta do lobby
                                                </p>
                                                <p className="mt-1 font-mono text-lg font-semibold text-slate-800">
                                                    {port}
                                                </p>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-slate-800">
                                                Jogadores
                                            </h3>
                                            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                                                {connectedPlayers.length}
                                            </span>
                                        </div>

                                        <ul className="mt-4 space-y-2">
                                            {connectedPlayers.map((player) => (
                                                <li
                                                    key={player.id}
                                                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-medium text-slate-700">
                                                            {player.name}
                                                        </span>
                                                        <span
                                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                player.isReady
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : 'bg-slate-200 text-slate-600'
                                                            }`}
                                                        >
                                                            {player.isReady
                                                                ? 'Pronto'
                                                                : 'Aguardando'}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm text-slate-500">
                                                        {player.isHost
                                                            ? 'Host'
                                                            : 'Jogador'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <button
                                        type="button"
                                        className={`w-full rounded-xl px-4 py-3 font-semibold text-white transition ${
                                            isHost && allPlayersReady
                                                ? 'bg-slate-900 hover:bg-slate-700'
                                                : 'cursor-not-allowed bg-slate-400'
                                        }`}
                                        onClick={handleStartGame}
                                        disabled={
                                            !isHost ||
                                            !allPlayersReady ||
                                            loading
                                        }
                                    >
                                        {!isHost
                                            ? 'Aguardando o host iniciar a partida'
                                            : loading
                                              ? 'Aguardando'
                                              : allPlayersReady
                                                ? 'Iniciar partida'
                                                : 'Aguardando jogadores ficarem prontos'}
                                    </button>

                                    <button
                                        type="button"
                                        className={`w-full rounded-xl px-4 py-3 font-semibold transition ${
                                            isReady
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                        }`}
                                        onClick={() => handleChangeIsReady()}
                                        disabled={loading}
                                    >
                                        {loading
                                            ? 'Aguardando'
                                            : isReady
                                              ? 'Pronto ✓'
                                              : 'Marcar como pronto'}
                                    </button>

                                    <button
                                        type="button"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
                                        onClick={onBackToHome}
                                        disabled={loading}
                                    >
                                        {loading
                                            ? 'Aguardando'
                                            : 'Voltar para a tela inicial'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
