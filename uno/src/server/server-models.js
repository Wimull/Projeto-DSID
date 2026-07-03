// server-models.js
// Singletons usados pelo servidor para manter o estado da partida e o consenso.

const GameState = require('./game-state')
const ConsensusManager = require('./consensus-manager')

const gameState = new GameState()
const consensusManager = new ConsensusManager(gameState)

function configurePeers(localPeerId, peerIds = []) {
  consensusManager.setLocalPeer(localPeerId)
  consensusManager.setPeerIds(peerIds)
}

module.exports = {
  gameState,
  consensusManager,
  configurePeers,
}
