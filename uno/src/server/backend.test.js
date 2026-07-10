const assert = require('assert')
const GameState = require('./game-state')
const ConsensusManager = require('./consensus-manager')
const LeaderElection = require('./leader-election')
const RoomManager = require('./room-manager')
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

function run() {
  runGameStateTests()
  runConsensusManagerTests()
  runTcpCoreTests()
  runLeaderElectionTests()
  runRoomManagerTests()
  console.log('backend tests passed')
}

run()
