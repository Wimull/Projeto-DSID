const assert = require('assert')
const GameState = require('./game-state')
const ConsensusManager = require('./consensus-manager')
const LeaderElection = require('./leader-election')
const RoomManager = require('./room-manager')
const FailureDetector = require('./failure-detector')
const StateReplicator = require('./state-replicator')
const { gameState, consensusManager } = require('./server-models')
const {
  createActionMessage,
  createConsensusReply,
  validateTcpMessage,
} = require('./tcp-core')

function runGameStateTests() {
  const state = new GameState()
  state.initialize({ roomID: 'room-1', playerID: 'player-1', players: ['player-1', 'player-2'], leader: 'player-1' })

  assert.strictEqual(state.getState().roomID, 'room-1')
  assert.strictEqual(state.getState().turnOrder.length, 2)
  assert.strictEqual(state.getState().currentTurn, 'player-1')

  state.applyAction(createActionMessage(1, { handler: 'ring-ring', args: {} }))
  assert.strictEqual(state.getState().history.length, 1)
  assert.strictEqual(state.getState().lastResult, 'ring-received')
  assert.strictEqual(state.getState().lastSeq, 1)

  state.applyAction(createActionMessage(2, { handler: 'make-factorial', args: { num: 3 } }))
  assert.strictEqual(state.getState().lastResult, 3)
  assert.strictEqual(state.getState().history.length, 2)
}

function runConsensusManagerTests() {
  const localState = new GameState()
  const localConsensus = new ConsensusManager(localState, 'local', ['peer-1', 'peer-2'])

  const action = createActionMessage(1, { handler: 'ring-ring' })
  const proposal = localConsensus.createProposal(action, 'local')
  assert.strictEqual(proposal.status, 'pending')

  localConsensus.registerResponse(1, 'local', true, 'ok')
  let result = localConsensus.registerResponse(1, 'peer-1', true, 'ok')
  assert.strictEqual(result.finalized, false)

  result = localConsensus.registerResponse(1, 'peer-2', true, 'ok')
  assert.strictEqual(result.finalized, true)
  assert.strictEqual(result.accepted, true)
  assert.strictEqual(localState.getState().history.length, 1)

  const action2 = createActionMessage(2, { handler: 'make-factorial', args: { num: 5 } })
  localConsensus.createProposal(action2, 'local')
  localConsensus.registerResponse(2, 'local', true, 'ok')
  result = localConsensus.registerResponse(2, 'peer-1', false, 'invalid')
  assert.strictEqual(result.finalized, false)
  assert.strictEqual(result.accepted, undefined)

  result = localConsensus.registerResponse(2, 'peer-2', false, 'invalid')
  assert.strictEqual(result.finalized, true)
  assert.strictEqual(result.accepted, false)
}

function runTcpCoreTests() {
  const action = createActionMessage(1, { handler: 'make-factorial', args: { num: 5 } })
  assert.strictEqual(action.type, 'action')
  assert.strictEqual(action.seq, 1)
  assert.deepStrictEqual(action.data, { handler: 'make-factorial', args: { num: 5 } })

  const agree = createConsensusReply(2, true, { reason: 'valid' })
  assert.strictEqual(agree.type, 'agree')
  assert.strictEqual(agree.seq, 2)

  const keepAlive = require('./tcp-core').createKeepAliveMessage(3)
  assert.strictEqual(keepAlive.type, 'keepAlive')
  assert.strictEqual(keepAlive.seq, 3)

  const ack = require('./tcp-core').createAckMessage(4, { received: true })
  assert.strictEqual(ack.type, 'ACK')

  const err = require('./tcp-core').createErrorMessage(5, { reason: 'bad payload' })
  assert.strictEqual(err.type, 'ERR')

  const serialized = require('./tcp-core').serializeTcpMessage(action)
  const parsed = require('./tcp-core').parseWireMessage(serialized)
  assert.strictEqual(parsed.kind, 'tcp')
  assert.strictEqual(parsed.message.type, 'action')

  const invalidAction = validateTcpMessage({ type: 'action', seq: 1, data: { handler: 123 } })
  assert.strictEqual(invalidAction.valid, false)
  assert.strictEqual(invalidAction.error, 'Action message must contain a non-empty handler string')

  const validAction = validateTcpMessage({ type: 'action', seq: 2, data: { handler: 'make-factorial', args: { num: 1 } } })
  assert.strictEqual(validAction.valid, true)

  const invalid = validateTcpMessage({ type: 'action', seq: 0, data: {} })
  assert.strictEqual(invalid.valid, false)
}

function runLeaderElectionTests() {
  const election = new LeaderElection('player-1')
  assert.strictEqual(election.getCurrentLeader(), null)
  assert.strictEqual(election.isLocalLeader(), false)

  election.registerPeer('player-1')
  assert.strictEqual(election.getCurrentLeader(), 'player-1')
  assert.strictEqual(election.isLocalLeader(), true)
  assert.strictEqual(election.getPeerCount(), 1)

  election.registerPeer('player-2')
  assert.strictEqual(election.getCurrentLeader(), 'player-2')
  assert.strictEqual(election.isLocalLeader(), false)
  assert.strictEqual(election.getPeerCount(), 2)

  election.registerPeer('player-3')
  assert.strictEqual(election.getCurrentLeader(), 'player-3')
  assert.deepStrictEqual(election.getActivePeers(), ['player-1', 'player-2', 'player-3'])

  let lastLeaderChange = null
  election.onLeaderChanged = (info) => {
    lastLeaderChange = info
  }

  election.unregisterPeer('player-3')
  assert(lastLeaderChange !== null, 'onLeaderChanged should have been called')
  assert.strictEqual(lastLeaderChange.newLeader, 'player-2', `Expected player-2 but got ${lastLeaderChange.newLeader}`)
  assert.strictEqual(election.getCurrentLeader(), 'player-2')
  assert.strictEqual(election.getPeerCount(), 2)

  election.unregisterPeer('player-1')
  assert.strictEqual(election.getCurrentLeader(), 'player-2')

  election.unregisterPeer('player-2')
  assert.strictEqual(election.getCurrentLeader(), null)
  assert.strictEqual(election.getPeerCount(), 0)

  const election2 = new LeaderElection('room-leader')
  election2.registerPeer('alpha')
  assert.strictEqual(election2.getCurrentLeader(), 'alpha')

  election2.registerPeer('beta')
  assert.strictEqual(election2.getCurrentLeader(), 'beta')

  election2.registerPeer('gamma')
  assert.strictEqual(election2.getCurrentLeader(), 'gamma')

  election2.handleLeaderFailure()
  assert.strictEqual(election2.getCurrentLeader(), 'beta')
}

function runRoomManagerTests() {
  const room = new RoomManager('room-1', 'creator-1')
  assert.strictEqual(room.getRoomStatus().status, 'waiting')
  assert.strictEqual(room.getRoomStatus().playerCount, 0)
  assert.strictEqual(room.getRoomStatus().canStart, false)

  const player1ID = room.addPlayer(null, 'Alice')
  assert(player1ID)
  assert.strictEqual(room.getRoomStatus().playerCount, 1)
  assert.strictEqual(room.isPlayerInRoom(player1ID), true)

  let joinEvent = null
  room.onPlayerJoined = (event) => {
    joinEvent = event
  }

  const player2ID = room.addPlayer(null, 'Bob')
  assert(joinEvent !== null)
  assert.strictEqual(joinEvent.playerCount, 2)
  assert.strictEqual(room.getRoomStatus().canStart, true)

  assert.deepStrictEqual(room.getPlayerIDs().sort(), [player1ID, player2ID].sort())

  let startEvent = null
  room.onRoomStarted = (event) => {
    startEvent = event
  }

  room.startRoom()
  assert.strictEqual(room.getRoomStatus().status, 'playing')
  assert(startEvent !== null)
  assert.strictEqual(startEvent.playerCount, 2)

  let leftEvent = null
  room.onPlayerLeft = (event) => {
    leftEvent = event
  }

  room.removePlayer(player2ID)
  assert(leftEvent !== null)
  assert.strictEqual(room.getRoomStatus().status, 'ended')

  const room2 = new RoomManager('room-2', 'creator-2')
  room2.addPlayer('player-x', 'Xavier')
  room2.addPlayer('player-y', 'Yuki')
  room2.addPlayer('player-z', 'Zoe')
  assert.strictEqual(room2.getRoomStatus().playerCount, 3)
  assert.strictEqual(room2.getRoomStatus().canStart, true)

  try {
    room2.addPlayer('player-w', 'William')
    room2.addPlayer('player-v', 'Victor')
    assert.fail('Should not allow more than maxPlayers')
  } catch (e) {
    assert(e.message.includes('full'))
  }
}

function runFailureDetectorTests() {
  const detector = new FailureDetector(100, 300)
  detector.registerPeer('peer-1')
  detector.registerPeer('peer-2')
  assert.strictEqual(detector.getAlivePeers().length, 2)
  assert.strictEqual(detector.getSuspectedPeers().length, 0)

  detector.recordHeartbeat('peer-1')
  const status = detector.getPeerStatus('peer-1')
  assert.strictEqual(status.status, 'alive')
  assert(status.heartbeatCount >= 1)

  let suspectedEvent = null
  detector.onPeerSuspected = (event) => {
    suspectedEvent = event
  }

  detector.startMonitoring('peer-2')
  detector.checkPeer('peer-2')
  assert(suspectedEvent === null)

  const startTime = new Date()
  while (new Date() - startTime < 350 && suspectedEvent === null) {
    detector.checkPeer('peer-2')
  }

  assert(suspectedEvent !== null, 'Peer should be suspected after timeout')
  assert.strictEqual(detector.getSuspectedPeers().length, 1)

  let restoredEvent = null
  detector.onPeerRestored = (event) => {
    restoredEvent = event
  }

  detector.recordHeartbeat('peer-2')
  assert(restoredEvent !== null)
  assert.strictEqual(detector.getAlivePeers().length, 2)

  detector.stopMonitoring('peer-2')
  detector.unregisterPeer('peer-1')
  assert.strictEqual(detector.getAlivePeers().length, 1)
}

function runStateReplicatorTests() {
  const localState = new GameState()
  const replicator = new StateReplicator(localState, null)

  localState.initialize({ roomID: 'room-1', playerID: 'local', players: ['local', 'peer-1'], leader: 'local' })
  const tcpCore = require('./tcp-core')
  const actionMsg = tcpCore.createActionMessage(1, { handler: 'ring-ring' })
  localState.applyAction(actionMsg)

  const snapshot = replicator.getStateSnapshot()
  assert.strictEqual(snapshot.roomID, 'room-1')
  assert.strictEqual(snapshot.lastSeq, 1)
  assert.strictEqual(snapshot.history.length, 1)

  const remoteState = new GameState()
  const remoteReplicator = new StateReplicator(remoteState, null)
  remoteState.initialize({ roomID: 'room-1', playerID: 'peer-1', players: ['local', 'peer-1'], leader: 'local' })

  remoteReplicator.applyStateSnapshot(snapshot)
  assert.strictEqual(remoteState.getState().lastSeq, 1)
  assert.strictEqual(remoteState.getState().history.length, 1)

  const consistency = remoteReplicator.validateStateConsistency(snapshot)
  assert.strictEqual(consistency.consistent, true)

  const historySince0 = replicator.getHistorySince(0)
  assert.strictEqual(historySince0.length, 1)

  const historySince1 = replicator.getHistorySince(1)
  assert.strictEqual(historySince1.length, 0)
}

function runFailureScenarioTests() {
  // Cenário 1: Peer timeout leva a remoção
  const detector = new FailureDetector(50, 150)
  detector.registerPeer('peer-1')
  detector.startMonitoring('peer-1')
  
  let suspectedEvent = null
  detector.onPeerSuspected = (event) => {
    suspectedEvent = event
  }
  
  // Deixar timeout acontecer
  detector.checkPeer('peer-1')
  const startTime = new Date()
  while (new Date() - startTime < 160 && suspectedEvent === null) {
    detector.checkPeer('peer-1')
  }
  assert(suspectedEvent !== null, 'Peer deveria ser suspeito após timeout')
  assert.strictEqual(detector.getSuspectedPeers().length, 1)
  detector.reset()

  // Cenário 2: Quorum loss (3 peers → 1 sai → 2 vivos)
  const state2 = new GameState()
  const room2 = new RoomManager()
  state2.initialize({ roomID: 'room-2', playerID: 'p1', players: ['p1', 'p2', 'p3'], leader: 'p1' })
  room2.addPlayer('p1', 'Player 1')
  room2.addPlayer('p2', 'Player 2')
  room2.addPlayer('p3', 'Player 3')
  
  assert.strictEqual(room2.getRoomStatus().playerCount, 3)
  assert.strictEqual(room2.getRoomStatus().canStart, true) // status='waiting', 3 players
  
  room2.startRoom()
  room2.removePlayer('p2')
  assert.strictEqual(room2.getRoomStatus().playerCount, 2)
  assert.strictEqual(room2.getRoomStatus().status, 'playing')
  
  // Cenário 3: Game over quando <2 jogadores
  room2.removePlayer('p3')
  assert.strictEqual(room2.getRoomStatus().playerCount, 1)
  
  let roomEndedEvent = null
  room2.onRoomEnded = (event) => {
    roomEndedEvent = event
  }
  
  // Quando fica <2 players, sala deve encerrar
  room2.removePlayer('p1')
  assert.strictEqual(room2.getRoomStatus().playerCount, 0)

  // Cenário 4: State replicator detecta inconsistência (Byzantine fault)
  const local = new GameState()
  const local_replicator = new StateReplicator(local, null)
  local.initialize({ roomID: 'room-3', playerID: 'local', players: ['local', 'remote'] })
  
  const snapshot = local_replicator.getStateSnapshot()
  snapshot.lastSeq = 5 // Simular divergência
  snapshot.history = [] // Histórico diferente
  
  const remote = new GameState()
  const remote_replicator = new StateReplicator(remote, null)
  remote.initialize({ roomID: 'room-3', playerID: 'remote', players: ['local', 'remote'] })
  remote.applyAction(require('./tcp-core').createActionMessage(1, { handler: 'ring-ring' }))
  remote.applyAction(require('./tcp-core').createActionMessage(2, { handler: 'ring-ring' }))
  remote.applyAction(require('./tcp-core').createActionMessage(3, { handler: 'ring-ring' }))
  
  const inconsistency = remote_replicator.detectLeaderInconsistency(snapshot)
  assert.strictEqual(inconsistency.shouldElectNewLeader, true)
  assert.strictEqual(inconsistency.inconsistency, 'seq-mismatch')

  // Cenário 5: Recuperação após desconexão (reconexão com snapshot)
  const leader_state = new GameState()
  const leader_replicator = new StateReplicator(leader_state, null)
  leader_state.initialize({ roomID: 'room-4', playerID: 'leader', players: ['leader', 'follower'] })
  
  // Líder executa 2 ações
  leader_state.applyAction(require('./tcp-core').createActionMessage(1, { handler: 'ring-ring' }))
  leader_state.applyAction(require('./tcp-core').createActionMessage(2, { handler: 'ring-ring' }))
  const leader_snapshot = leader_replicator.getStateSnapshot()
  assert.strictEqual(leader_snapshot.lastSeq, 2)
  
  // Follower reconecta e recebe snapshot
  const follower_state = new GameState()
  const follower_replicator = new StateReplicator(follower_state, null)
  follower_state.initialize({ roomID: 'room-4', playerID: 'follower', players: ['leader', 'follower'] })
  assert.strictEqual(follower_state.getState().lastSeq, 0)
  
  follower_replicator.applyStateSnapshot(leader_snapshot)
  assert.strictEqual(follower_state.getState().lastSeq, 2)
  assert.strictEqual(follower_state.getState().history.length, 2)
}

function run() {
  runGameStateTests()
  runConsensusManagerTests()
  runTcpCoreTests()
  runLeaderElectionTests()
  runRoomManagerTests()
  runFailureDetectorTests()
  runStateReplicatorTests()
  runFailureScenarioTests()
  console.log('backend tests passed')
}

run() 
