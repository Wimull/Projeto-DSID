const MESSAGE_TYPES = ['action', 'agree', 'disagree', 'keepAlive', 'ACK', 'ERR']

function assertValidSeq(seq) {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error('seq must be a positive integer')
  }
}

function buildTcpMessage(type, seq, data = {}) {
  if (!MESSAGE_TYPES.includes(type)) {
    throw new Error(`Unsupported TCP message type: ${type}`)
  }

  assertValidSeq(seq)

  return {
    type,
    seq,
    data: data === undefined ? {} : data,
  }
}

// Cria uma mensagem de ação conforme o protocolo descrito na wiki.
// O campo data carrega o payload da ação, como nome do handler e argumentos.
function createActionMessage(seq, payload = {}) {
  return buildTcpMessage('action', seq, payload)
}

// Respostas de consenso para o fluxo agree/disagree da wiki.
function createConsensusReply(seq, accepted, details = {}) {
  return buildTcpMessage(accepted ? 'agree' : 'disagree', seq, details)
}

// Mensagem de keepAlive usada para manter a conexão viva entre nós.
function createKeepAliveMessage(seq = 1) {
  return buildTcpMessage('keepAlive', seq, {
    timestamp: new Date().toISOString(),
  })
}

// Confirmação de recebimento de uma mensagem.
function createAckMessage(seq, details = {}) {
  return buildTcpMessage('ACK', seq, details)
}

// Mensagem de erro padronizada para falhas de validação ou execução.
function createErrorMessage(seq, details = {}) {
  return buildTcpMessage('ERR', seq, details)
}

function validateActionData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      valid: false,
      error: 'Action message data must be an object',
    }
  }

  if (typeof data.handler !== 'string' || data.handler.length === 0) {
    return {
      valid: false,
      error: 'Action message must contain a non-empty handler string',
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'args')) {
    if (data.args === null || typeof data.args !== 'object' || Array.isArray(data.args)) {
      return {
        valid: false,
        error: 'Action message args must be an object when present',
      }
    }
  }

  return { valid: true }
}

function validateTcpMessage(message) {
  if (!isWikiTcpMessage(message)) {
    return {
      valid: false,
      error: 'Message must follow the wiki TCP envelope with type, seq and data',
    }
  }

  if (message.type === 'action') {
    const actionValidation = validateActionData(message.data)
    if (!actionValidation.valid) {
      return actionValidation
    }
  }

  return { valid: true, message }
}

function isWikiTcpMessage(message) {
  return Boolean(
    message &&
      typeof message === 'object' &&
      !Array.isArray(message) &&
      typeof message.type === 'string' &&
      MESSAGE_TYPES.includes(message.type) &&
      Number.isInteger(message.seq) &&
      message.seq > 0 &&
      Object.prototype.hasOwnProperty.call(message, 'data')
  )
}

function isLegacyRequest(message) {
  return Boolean(
    message &&
      typeof message === 'object' &&
      !Array.isArray(message) &&
      typeof message.name === 'string' &&
      Object.prototype.hasOwnProperty.call(message, 'args') &&
      Object.prototype.hasOwnProperty.call(message, 'id')
  )
}

function parseWireMessage(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload

  if (isWikiTcpMessage(parsed)) {
    return { kind: 'tcp', message: parsed }
  }

  if (isLegacyRequest(parsed)) {
    return { kind: 'legacy', message: parsed }
  }

  throw new Error('Unsupported message payload')
}

function serializeTcpMessage(message) {
  return JSON.stringify(message)
}

module.exports = {
  MESSAGE_TYPES,
  buildTcpMessage,
  createActionMessage,
  createConsensusReply,
  createKeepAliveMessage,
  createAckMessage,
  createErrorMessage,
  isWikiTcpMessage,
  isLegacyRequest,
  parseWireMessage,
  serializeTcpMessage,
  validateTcpMessage,
}
