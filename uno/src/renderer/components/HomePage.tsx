import React from 'react'

const cardAssets = ['/red0.png', '/blue0.png', '/yellow0.png', '/green0.png']

type HomePageProps = {
    lobbyAddress: string
    onLobbyAddressChange: (value: string) => void
    onJoinLobby: () => void
    onCreateLobby: () => void
}

export default function HomePage({
    lobbyAddress,
    onLobbyAddressChange,
    onJoinLobby,
    onCreateLobby,
}: HomePageProps) {
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
                                    Multiplayer P2P
                                </p>
                                <h1 className="mt-3 text-5xl font-black sm:text-6xl">
                                    Uno
                                </h1>
                                <p className="mt-4 max-w-md text-lg text-white/90">
                                    Entre em um lobby com seus amigos ou crie um
                                    em poucos segundos.
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
                            <div className="space-y-5">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-500">
                                        Entrar ou criar
                                    </p>
                                    <h2 className="mt-2 text-3xl font-bold text-slate-800">
                                        Comece uma partida
                                    </h2>
                                </div>

                                <div className="space-y-2">
                                    <label
                                        htmlFor="lobby-address"
                                        className="text-sm font-medium text-slate-700"
                                    >
                                        Endereço IP do lobby
                                    </label>
                                    <input
                                        id="lobby-address"
                                        type="text"
                                        value={lobbyAddress}
                                        onChange={(event) =>
                                            onLobbyAddressChange(
                                                event.target.value
                                            )
                                        }
                                        placeholder="192.168.0.10:8080"
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-200"
                                    />
                                    <p className="text-sm text-slate-500">
                                        Digite um endereço IPv4 com porta.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="w-full rounded-xl bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-600"
                                    onClick={onJoinLobby}
                                >
                                    Entrar no lobby
                                </button>

                                <div className="flex items-center gap-3">
                                    <div className="h-px flex-1 bg-slate-200" />
                                    <span className="text-sm text-slate-400">
                                        ou
                                    </span>
                                    <div className="h-px flex-1 bg-slate-200" />
                                </div>

                                <button
                                    type="button"
                                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
                                    onClick={onCreateLobby}
                                >
                                    Criar lobby
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
