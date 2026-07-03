// game-state.js
// Armazenamento de estado da partida conforme o modelo de replicação da wiki.
// O estado inclui sala, jogadores, histórico de ações e o último seq processado.

class GameState {
  constructor() {
    this.reset()
  }

  reset() {
    this.state = {
      roomID: null,
      playerID: null,
      leader: null,
      status: 'waiting',
      deck: [],
      discard: [],
      hands: {},
      turnOrder: [],
      currentTurn: null,
      history: [],
      lastSeq: 0,
      lastResult: null,
    }
  }

  initialize({ roomID, playerID, players = [], leader = null }) {
    this.reset()
    this.state.roomID = roomID
    this.state.playerID = playerID
    this.state.leader = leader || playerID
    this.state.status = 'playing'
    this.state.turnOrder = Array.isArray(players) ? players.slice() : []
    this.state.currentTurn = this.state.turnOrder.length > 0 ? this.state.turnOrder[0] : null
    this.state.hands = this.state.turnOrder.reduce((hands, id) => {
      hands[id] = []
      return hands
    }, {})
  }

  applyAction(actionMessage) {
    const { seq, data } = actionMessage

    if (!Number.isInteger(seq) || seq <= 0) {
      throw new Error('Action seq must be a positive integer')
    }

    if (seq <= this.state.lastSeq) {
      throw new Error('Action seq must be greater than last processed seq')
    }

    this.state.lastSeq = seq
    const entry = {
      seq,
      handler: data.handler,
      args: data.args || {},
      timestamp: new Date().toISOString(),
    }

    this.state.history.push(entry)

    if (data.handler === 'ring-ring') {
      this.state.lastResult = 'ring-received'
      this.state.lastPing = entry.timestamp
    }

    if (data.handler === 'make-factorial') {
      this.state.lastResult = data.args?.num
    }

    this.state.currentAction = entry
    return this.getState()
  }

  getState() {
    return JSON.parse(JSON.stringify(this.state))
  }
}

module.exports = GameState
