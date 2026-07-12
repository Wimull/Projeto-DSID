import React, { useEffect, useState } from 'react'
// Suppress TypeScript error for side-effect CSS import when no declaration is present
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: TS2307
import './index.css'
import GamePage from './components/GamePage'
import HomePage from './components/HomePage'
import LobbyPage from './components/LobbyPage'

export default function App() {
    const [connected, setConnected] = useState(false)
    const [currPage, setCurrPage] = useState<'home' | 'lobby' | 'game'>('home')
    const [lobbyAddress, setLobbyAddress] = useState('192.168.0.10:8080')
    const [createdLobby, setCreatedLobby] = useState(false)

    //@ts-ignore
    listen('ready', () => {
        setConnected(true)
    })

    useEffect(() => {
        if (!connected) {
            return
        }

        //@ts-ignore
        send('ring-ring', []).then((result) => {
            console.log('result from ring-ring:', result)
        })
    }, [connected])

    if (currPage === 'game') {
        return <GamePage onReturnToLobby={() => setCurrPage('lobby')} />
    }

    if (currPage === 'lobby') {
        return (
            <LobbyPage
                onBackToHome={() => setCurrPage('home')}
                onStartGame={() => setCurrPage('game')}
                createdLobby={createdLobby}
            />
        )
    }

    return (
        <HomePage
            lobbyAddress={lobbyAddress}
            onLobbyAddressChange={setLobbyAddress}
            onJoinLobby={() => {
                setCurrPage('lobby')
                setCreatedLobby(false)
            }}
            onCreateLobby={() => {
                setCurrPage('lobby')
                setCreatedLobby(true)
            }}
        />
    )
}
