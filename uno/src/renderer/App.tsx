import React, { useEffect, useState } from 'react'
// Suppress TypeScript error for side-effect CSS import when no declaration is present
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: TS2307
import './index.css'
import GamePage from './components/GamePage'

export default function App() {
    const [connected, setConnected] = useState(false)
    const [currPage, setCurrPage] = useState<'home' | 'lobby' | 'game'>('home')
    //@ts-ignore
    listen('ready', () => {
        setConnected(true)
    })
    useEffect(() => {
        if (!connected) {
            return
        } else {
            //@ts-ignore
            send('ring-ring', []).then((result) => {
                console.log('result from ring-ring:', result)
            })
        }
    }, [connected])
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            {currPage === 'home' ? (
                <div>
                    <h1>Uno</h1>
                    <button
                        type="button"
                        className="px-4 py-2 mt-4 text-white bg-blue-500 rounded hover:bg-blue-600"
                        onClick={() => setCurrPage('game')}
                    >
                        Jogar
                    </button>
                </div>
            ) : currPage === 'lobby' ? (
                <div>
                    <h1>Lobby</h1>
                </div>
            ) : currPage === 'game' ? (
                <GamePage />
            ) : null}
        </div>
    )
}
