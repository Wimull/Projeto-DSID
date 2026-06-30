const ipc = require('node-ipc')
const {
  createAckMessage,
  createErrorMessage,
  parseWireMessage,
  serializeTcpMessage,
  validateTcpMessage,
} = require('./tcp-core')

function init(socketName, handlers) {
  // O id do socket é o identificador da sala/nó, como descrito na wiki.
  ipc.config.id = socketName
  ipc.config.silent = true

  ipc.serve(() => {
    ipc.server.on('message', (data, socket) => {
      // O backend recebe uma mensagem bruta da rede e tenta interpretá-la.
      // Isso permite aceitar tanto o formato legado do projeto quanto o envelope TCP da wiki.
      const parsed = parseWireMessage(data)

      if (parsed.kind === 'legacy') {
        const { id, name, args } = parsed.message
        handleLegacyRequest({ id, name, args, socket, handlers })
        return
      }

      const { message } = parsed
      const validation = validateTcpMessage(message)

      if (!validation.valid) {
        ipc.server.emit(socket, 'message', serializeTcpMessage(createErrorMessage(message.seq || 1, { reason: validation.error })))
        return
      }

      // Para a wiki, uma mensagem de action é o ponto de entrada para uma ação de jogo.
      if (message.type === 'action') {
        const { handler, args = {} } = message.data || {}
        if (handlers[handler]) {
          handlers[handler](args).then(
            result => {
              // Em caso de sucesso, responde com ACK e o resultado da execução.
              ipc.server.emit(socket, 'message', serializeTcpMessage(createAckMessage(message.seq, { result })))
            },
            error => {
              // Em caso de erro, devolve uma mensagem ERR com detalhes do problema.
              ipc.server.emit(socket, 'message', serializeTcpMessage(createErrorMessage(message.seq, { reason: error.message || 'handler failed' })))
              throw error
            }
          )
        } else {
          ipc.server.emit(socket, 'message', serializeTcpMessage(createErrorMessage(message.seq, { reason: 'unknown handler' })))
        }
        return
      }

      // Mensagens keepAlive e outras sem payload de execução são aceitas de forma simples.
      if (message.type === 'keepAlive') {
        ipc.server.emit(socket, 'message', serializeTcpMessage(createAckMessage(message.seq, { status: 'alive' })))
      }
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

module.exports = { init, send }