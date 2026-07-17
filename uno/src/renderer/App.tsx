import React, { useEffect, useState } from 'react'
import { type Player } from './components/GamePage'
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
    const [players, setPlayers] = useState<Player[]>([])
    const [hasJoined, setHasJoined] = useState(false)
    const [starterPlayerTurnId, setStarterPlayerTurnId] = useState('')
    const [starterColor, setStarterColor] = useState('')
    const [starterPlayedCard, setStarterPlayedCard] = useState('')
    const [userPort, setUserPort] = useState('')

    const handleReturnHome = async () => {
        if (hasJoined) {
            await send('disconnect', {}).catch((e) => {
                alert('Erro ao tentar voltar para a tela inicial: ' + e.message)
            })
        }
        setPlayers([])
        setHasJoined(false)
        setStarterPlayerTurnId('')
        setCurrPage('home')
    }

    if (currPage === 'game') {
        return (
            <GamePage
                onReturnToLobby={(currPlayers) => {
                    setPlayers(currPlayers)
                    setHasJoined(true)
                    setStarterPlayerTurnId('')
                    setCurrPage('lobby')
                }}
                onReturnHome={() => {
                    handleReturnHome()
                }}
                playerName={
                    players[players.findIndex((p) => p.isUser)]?.name ?? ''
                }
                playerId={players[players.findIndex((p) => p.isUser)]?.id ?? ''}
                starterPlayerTurnId={starterPlayerTurnId}
                starterPlayers={players}
                starterIsHost={
                    players[players.findIndex((p) => p.isUser)]?.isHost ?? false
                }
                starterColor={starterColor}
                starterPlayedCard={starterPlayedCard}
            />
        )
    }
    if (currPage === 'lobby') {
        return (
            <LobbyPage
                onBackToHome={() => {
                    handleReturnHome()
                }}
                onStartGame={(
                    currPlayers,
                    starterTurn,
                    starterColor,
                    starterPlayedCard
                ) => {
                    setPlayers(currPlayers)
                    setStarterPlayerTurnId(starterTurn)
                    setStarterColor(starterColor)
                    setStarterPlayedCard(starterPlayedCard)
                    setCurrPage('game')
                }}
                createdLobby={createdLobby}
                starterPlayers={players}
                starterPlayerName={
                    players[players.findIndex((p) => p.isUser)]?.name ?? ''
                }
                starterPlayerId={
                    players[players.findIndex((p) => p.isUser)]?.id ?? ''
                }
                lobbyIP={lobbyAddress}
                starterHasJoined={hasJoined}
                port={userPort}
                onPortChange={setUserPort}
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
