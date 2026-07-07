const ipc = require('node-ipc')
const {
  createAckMessage,
  createConsensusReply,
  createErrorMessage,
  parseWireMessage,
  serializeTcpMessage,
  validateTcpMessage,
} = require('./tcp-core')
const { gameState, consensusManager } = require('./server-models')
const FailureDetector = require('./failure-detector')
const StateReplicator = require('./state-replicator')
const RoomManager = require('./room-manager')

// Instâncias para detecção de falhas e replicação de estado
const failureDetector = new FailureDetector(2000, 5000)
const stateReplicator = new StateReplicator(gameState, consensusManager)
const roomManager = new RoomManager()
let keepAliveInterval = null
let seqCounter = 0

// Callback: ao detectar peer suspeito, remover do jogo
failureDetector.onPeerSuspected = ({peerId, timeSinceLastHeartbeat}) => {
  console.log(`[FAILURE] Peer ${peerId} suspeito após ${timeSinceLastHeartbeat}ms`)
  
  // Remover jogador da sala
  roomManager.removePlayer(peerId)
  
  // Se era líder: nova eleição
  const LeaderElection = require('./leader-election')
  if (LeaderElection.currentLeader === peerId) {
    console.log(`[FAILURE] Líder ${peerId} offline, nova eleição...`)
    LeaderElection.handleLeaderFailure()
  }
  
  // Se <2 jogadores: game over
  if (roomManager.getRoomStatus().playerCount < 2) {
    console.log('[FAILURE] Quorum perdido, encerrando partida')
    roomManager.endRoom('quorum-loss')
  }
}

// Instâncias para detecção de falhas e replicação de estado
const failureDetector = new FailureDetector(2000, 5000)
const stateReplicator = new StateReplicator(gameState, consensusManager)
const roomManager = new RoomManager()
let keepAliveInterval = null
let seqCounter = 0

// Callback: ao detectar peer suspeito, remover do jogo
failureDetector.onPeerSuspected = ({peerId, timeSinceLastHeartbeat}) => {
  console.log(`[FAILURE] Peer ${peerId} suspeito após ${timeSinceLastHeartbeat}ms`)
  
  // Remover jogador da sala
  roomManager.removePlayer(peerId)
  
  // Se era líder: nova eleição
  const LeaderElection = require('./leader-election')
  if (LeaderElection.currentLeader === peerId) {
    console.log(`[FAILURE] Líder ${peerId} offline, nova eleição...`)
    LeaderElection.handleLeaderFailure()
  }
  
  // Se <2 jogadores: game over
  if (roomManager.getRoomStatus().playerCount < 2) {
    console.log('[FAILURE] Quorum perdido, encerrando partida')
    roomManager.endRoom('quorum-loss')
  }
}

// Validação local de ações. Em uma arquitetura P2P, cada nó aplica sua própria validação
// antes de responder com `agree` ou `disagree`, conforme o contrato da wiki.
function validateGameAction(data) {
  if (data.handler === 'make-factorial') {
    if (!data.args || !Number.isInteger(data.args.num) || data.args.num < 1) {
      return { valid: false, reason: 'make-factorial requires a positive integer num' }
    }
    if (data.args.num > 1000) {
      return { valid: false, reason: 'make-factorial num is too large' }
    }
  }

  if (data.handler === 'ring-ring') {
    if (data.args && Object.keys(data.args).length > 0) {
      return { valid: false, reason: 'ring-ring does not accept args' }
    }
  }

  return { valid: true }
}

function respond(socket, message) {
  const serialized = serializeTcpMessage(message)

  if (socket && typeof socket.emit === 'function') {
    socket.emit('message', serialized)
    return
  }

  ipc.server.emit(socket, 'message', serialized)
}

const pendingActionSockets = new Map()

function handleFinalizedProposal(proposal, handlers) {
  if (!proposal || proposal.executed) {
    return
  }

  proposal.executed = true
  const socket = pendingActionSockets.get(proposal.key)

  try {
    const { handler, args = {} } = proposal.message.data || {}
    gameState.applyAction(proposal.message)

    if (handler && handlers[handler]) {
      handlers[handler](args).then(
        result => {
          if (socket) {
            respond(socket, createAckMessage(proposal.message.seq, { result, state: gameState.getState() }))
          }
        },
        error => {
          if (socket) {
            respond(socket, createErrorMessage(proposal.message.seq, { reason: error.message || 'handler failed' }))
          }
        }
      )
    } else if (socket) {
      respond(socket, createAckMessage(proposal.message.seq, { status: 'committed', state: gameState.getState() }))
    }
  } finally {
    if (proposal.key) {
      pendingActionSockets.delete(proposal.key)
    }
  }
}

function handleActionMessage(socket, message, handlers) {
  const validationResult = validateGameAction(message.data)

  if (!validationResult.valid) {
    respond(socket, createConsensusReply(message.seq, false, { reason: validationResult.reason }))
    return
  }

  const proposal = consensusManager.createProposal(message, message.data?.peerId || 'local')
  pendingActionSockets.set(proposal.key, socket)

  respond(socket, createConsensusReply(message.seq, true, { reason: 'locally validated' }))

  const localVote = consensusManager.registerLocalVote(message.seq, true, 'locally validated')
  if (localVote.finalized && localVote.accepted) {
    handleFinalizedProposal(consensusManager.getProposal(message.seq), handlers)
  }
}

function handleConsensusReply(socket, message, handlers) {
  const peerId = message.data?.peerId || 'remote-peer'
  const registered = consensusManager.registerResponse(message.seq, peerId, message.type === 'agree', message.data?.reason)

  if (registered.finalized && registered.accepted) {
    handleFinalizedProposal(consensusManager.getProposal(message.seq), handlers)
  }
}

function handleIncomingMessage(data, socket, handlers) {
  let parsed

  try {
    parsed = parseWireMessage(data)
  } catch (error) {
    respond(socket, createErrorMessage(1, { reason: error.message || 'invalid payload' }))
    return
  }

  if (parsed.kind === 'legacy') {
    const { id, name, args } = parsed.message
    handleLegacyRequest({ id, name, args, socket, handlers })
    return
  }

  const { message } = parsed
  const validation = validateTcpMessage(message)

  if (!validation.valid) {
    respond(socket, createErrorMessage(message.seq || 1, { reason: validation.error }))
    return
  }

  if (message.type === 'action') {
    handleActionMessage(socket, message, handlers)
    return
  }

  if (message.type === 'agree' || message.type === 'disagree') {
    handleConsensusReply(socket, message, handlers)
    return
  }

  if (message.type === 'keepAlive') {
    // Rastrear heartbeat do peer
    const peerId = message.data?.peerId || message.from || 'remote-peer'
    failureDetector.recordHeartbeat(peerId)
    respond(socket, createAckMessage(message.seq, { status: 'alive' }))
    return
  }
}

function init(socketName, handlers, peers = []) {
  // O id do socket é o identificador da sala/nó, como descrito na wiki.
  ipc.config.id = socketName
  ipc.config.silent = true

  // Registrar peers para detecção de falhas
  peers.forEach(peerId => {
    failureDetector.registerPeer(peerId)
    failureDetector.startMonitoring(peerId)
  })

  // Enviar keepAlive periódico
  if (keepAliveInterval) clearInterval(keepAliveInterval)
  keepAliveInterval = setInterval(() => {
    seqCounter++
    const keepAliveMsg = {
      type: 'keepAlive',
      seq: seqCounter,
      data: {peerId: socketName},
    }
    const serialized = serializeTcpMessage(keepAliveMsg)
    ipc.server.broadcast('message', serialized)
  }, 2000)

  ipc.serve(() => {
    ipc.server.on('message', (data, socket) => {
      handleIncomingMessage(data, socket, handlers)
    })
  })

  ipc.server.start()
}

function handleLegacyRequest({ id, name, args, socket, handlers }) {
  if (handlers[name]) {
    handlers[name](args).then(
      result => {
        ipc.server.emit(socket, 'message', JSON.stringify({ type: 'reply', id, result }))
      },
      error => {
        ipc.server.emit(socket, 'message', JSON.stringify({ type: 'error', id }))
        throw error
      }
    )
  } else {
    console.warn('Unknown method: ' + name)
    ipc.server.emit(socket, 'message', JSON.stringify({ type: 'reply', id, result: null }))
  }
}

function send(name, args) {
  // Broadcast simples para empurrar uma mensagem para os peers conectados.
  ipc.server.broadcast('message', JSON.stringify({ type: 'push', name, args }))
}

module.exports = {
  init,
  send,
  handleIncomingMessage,
  handleActionMessage,
  handleFinalizedProposal,
  failureDetector,
  stateReplicator,
  roomManager,
}
