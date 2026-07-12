import React, { useMemo, useState } from 'react'

const cardAssets = ['/red0.png', '/blue0.png', '/yellow0.png', '/green0.png']

type LobbyPageProps = {
    onBackToHome: () => void
    onStartGame: () => void
    createdLobby: boolean
}

export default function LobbyPage({
    onBackToHome,
    onStartGame,
    createdLobby,
}: LobbyPageProps) {
    const [playerName, setPlayerName] = useState('')
    const [hasJoined, setHasJoined] = useState(false)
    const [isReady, setIsReady] = useState(false)

    const connectedPlayers = useMemo(() => {
        const players = []

        if (hasJoined && playerName.trim()) {
            players.push({
                id: 'me',
                name: playerName.trim(),
                role: createdLobby ? 'Host' : 'Player',
                ready: isReady,
            })
        }

        return players
    }, [hasJoined, playerName, isReady, createdLobby])

    const handleContinue = () => {
        if (playerName.trim()) {
            setHasJoined(true)
        }
    }

    const allPlayersReady =
        connectedPlayers.length > 0 &&
        connectedPlayers.every((player) => player.ready)
    const isHost = createdLobby

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
                                    >
                                        Continuar
                                    </button>

                                    <button
                                        type="button"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
                                        onClick={onBackToHome}
                                    >
                                        Voltar para a tela inicial
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
                                                                player.ready
                                                                    ? 'bg-emerald-100 text-emerald-700'
                                                                    : 'bg-slate-200 text-slate-600'
                                                            }`}
                                                        >
                                                            {player.ready
                                                                ? 'Pronto'
                                                                : 'Aguardando'}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm text-slate-500">
                                                        {player.role}
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
                                        onClick={onStartGame}
                                        disabled={!isHost || !allPlayersReady}
                                    >
                                        {isHost
                                            ? allPlayersReady
                                                ? 'Iniciar partida'
                                                : 'Aguardando jogadores ficarem prontos'
                                            : 'Aguardando o host iniciar a partida'}
                                    </button>

                                    <button
                                        type="button"
                                        className={`w-full rounded-xl px-4 py-3 font-semibold transition ${
                                            isReady
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                        }`}
                                        onClick={() =>
                                            setIsReady((current) => !current)
                                        }
                                    >
                                        {isReady
                                            ? 'Pronto ✓'
                                            : 'Marcar como pronto'}
                                    </button>

                                    <button
                                        type="button"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
                                        onClick={onBackToHome}
                                    >
                                        Voltar para a tela inicial
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
