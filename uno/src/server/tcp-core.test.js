const assert = require('assert')
const {
  createActionMessage,
  createConsensusReply,
  createKeepAliveMessage,
  createAckMessage,
  createErrorMessage,
  parseWireMessage,
  serializeTcpMessage,
  validateTcpMessage,
} = require('./tcp-core')

function run() {
  const action = createActionMessage(1, { handler: 'make-factorial', args: { num: 5 } })
  assert.strictEqual(action.type, 'action')
  assert.strictEqual(action.seq, 1)
  assert.deepStrictEqual(action.data, { handler: 'make-factorial', args: { num: 5 } })

  const agree = createConsensusReply(2, true, { reason: 'valid' })
  assert.strictEqual(agree.type, 'agree')
  assert.strictEqual(agree.seq, 2)

  const keepAlive = createKeepAliveMessage(3)
  assert.strictEqual(keepAlive.type, 'keepAlive')
  assert.strictEqual(keepAlive.seq, 3)

  const ack = createAckMessage(4, { received: true })
  assert.strictEqual(ack.type, 'ACK')

  const err = createErrorMessage(5, { reason: 'bad payload' })
  assert.strictEqual(err.type, 'ERR')

  const serialized = serializeTcpMessage(action)
  const parsed = parseWireMessage(serialized)
  assert.strictEqual(parsed.kind, 'tcp')
  assert.strictEqual(parsed.message.type, 'action')

  const invalid = validateTcpMessage({ type: 'action', seq: 0, data: {} })
  assert.strictEqual(invalid.valid, false)

  console.log('tcp-core tests passed')
}

run()
