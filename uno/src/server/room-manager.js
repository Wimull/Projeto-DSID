// room-manager.js
// Gerenciador de sala e ciclo de vida de uma partida.
// Controla a entrada/saída de jogadores, estado da sala (lobby, playing, finished).

const { v4: uuidv4 } = require('uuid')

class RoomManager {
  constructor(roomID = null, creatorID = null) {
    this.roomID = roomID || uuidv4()
    this.creatorID = creatorID || 'unknown'
    this.players = new Map()
    this.roomStatus = 'waiting'
    this.minPlayers = 2
    this.maxPlayers = 4
    this.startedAt = null
    this.joinedAt = {}
    this.onPlayerJoined = null
    this.onPlayerLeft = null
    this.onRoomStarted = null
    this.onRoomEnded = null
  }

  // Gera um ID único para jogador usando UUID.
  // Pode ser usado quando um jogador se conecta sem ID pré-definido.
  generatePlayerID() {
    return uuidv4().substring(0, 8)
  }

  // Adiciona um jogador à sala com um ID fornecido ou gerado.
  // Retorna o ID atribuído ao jogador.
  addPlayer(playerID = null, playerName = 'Player') {
    if (!playerID) {
      playerID = this.generatePlayerID()
    }

    if (this.players.has(playerID)) {
      throw new Error(`Player ${playerID} already in room`)
    }

    if (this.players.size >= this.maxPlayers) {
      throw new Error('Room is full')
    }

    this.players.set(playerID, {
      id: playerID,
      name: playerName,
      joinedAt: new Date().toISOString(),
      status: 'active',
    })

    this.joinedAt[playerID] = new Date().toISOString()

    if (this.onPlayerJoined) {
      this.onPlayerJoined({
        playerID,
        playerName,
        playerCount: this.players.size,
      })
    }

    return playerID
  }

  // Remove um jogador da sala.
  // Se a partida estava em andamento, pode encerrar ou resincronizar.
  removePlayer(playerID) {
    if (!this.players.has(playerID)) {
      return false
    }

    this.players.delete(playerID)
    delete this.joinedAt[playerID]

    if (this.onPlayerLeft) {
      this.onPlayerLeft({
        playerID,
        playerCount: this.players.size,
        roomStatus: this.roomStatus,
      })
    }

    if (this.roomStatus === 'playing' && this.players.size < this.minPlayers) {
      this.endRoom('player-disconnect')
    }

    return true
  }

  // Inicia a partida quando há quórum mínimo de jogadores.
  // Muda o status de 'waiting' para 'playing'.
  startRoom() {
    if (this.roomStatus !== 'waiting') {
      throw new Error(`Cannot start room with status: ${this.roomStatus}`)
    }

    if (this.players.size < this.minPlayers) {
      throw new Error(`Need at least ${this.minPlayers} players to start`)
    }

    this.roomStatus = 'playing'
    this.startedAt = new Date().toISOString()

    if (this.onRoomStarted) {
      this.onRoomStarted({
        roomID: this.roomID,
        playerCount: this.players.size,
        players: Array.from(this.players.keys()),
      })
    }
  }

  // Encerra a partida.
  endRoom(reason = 'finished') {
    this.roomStatus = 'ended'

    if (this.onRoomEnded) {
      this.onRoomEnded({
        roomID: this.roomID,
        reason,
        playedDuration: this.startedAt ? new Date() - new Date(this.startedAt) : null,
      })
    }
  }

  // Retorna a lista de todos os jogadores na sala.
  getPlayers() {
    return Array.from(this.players.values())
  }

  // Retorna apenas os IDs dos jogadores.
  getPlayerIDs() {
    return Array.from(this.players.keys())
  }

  getRoomStatus() {
    return {
      roomID: this.roomID,
      creatorID: this.creatorID,
      status: this.roomStatus,
      playerCount: this.players.size,
      minPlayers: this.minPlayers,
      maxPlayers: this.maxPlayers,
      canStart: this.players.size >= this.minPlayers && this.roomStatus === 'waiting',
      players: this.getPlayers(),
    }
  }

  isPlayerInRoom(playerID) {
    return this.players.has(playerID)
  }

  reset() {
    this.players.clear()
    this.joinedAt = {}
    this.roomStatus = 'waiting'
    this.startedAt = null
  }
}

module.exports = RoomManager
