// failure-detector.js
// Módulo de detecção de falhas via KeepAlive/Heartbeat.
// Implementa timeout de 5 segundos conforme descrito na wiki.

class FailureDetector {
  constructor(heartbeatInterval = 2000, heartbeatTimeout = 5000) {
    this.heartbeatInterval = heartbeatInterval
    this.heartbeatTimeout = heartbeatTimeout
    this.peerHeartbeats = new Map()
    this.intervalHandles = new Map()
    this.onPeerSuspected = null
    this.onPeerRestored = null
  }

  // Registra um peer no detector de falhas.
  // Inicia heartbeat periódico e monitora responsividade.
  registerPeer(peerId) {
    if (!peerId) return

    this.peerHeartbeats.set(peerId, {
      peerId,
      lastHeartbeat: new Date(),
      status: 'alive',
      suspectedAt: null,
      heartbeatCount: 0,
    })
  }

  // Remove um peer do detector de falhas.
  unregisterPeer(peerId) {
    if (!peerId) return

    const handle = this.intervalHandles.get(peerId)
    if (handle) {
      clearTimeout(handle)
      this.intervalHandles.delete(peerId)
    }

    this.peerHeartbeats.delete(peerId)
  }

  // Registra um heartbeat recebido de um peer.
  // Se o peer estava suspeito, marca como restaurado.
  recordHeartbeat(peerId) {
    if (!peerId) return

    const record = this.peerHeartbeats.get(peerId)
    if (!record) {
      this.registerPeer(peerId)
      return
    }

    record.lastHeartbeat = new Date()
    record.heartbeatCount++

    if (record.status === 'suspected') {
      record.status = 'alive'
      record.suspectedAt = null

      if (this.onPeerRestored) {
        this.onPeerRestored({
          peerId,
          heartbeatCount: record.heartbeatCount,
        })
      }
    }
  }

  // Verifica se um peer está dentro do timeout.
  // Se não responder por 5 segundos, marca como suspeito/offline.
  checkPeer(peerId) {
    const record = this.peerHeartbeats.get(peerId)
    if (!record) return

    const timeSinceLastHeartbeat = new Date() - record.lastHeartbeat

    if (timeSinceLastHeartbeat > this.heartbeatTimeout) {
      if (record.status === 'alive') {
        record.status = 'suspected'
        record.suspectedAt = new Date().toISOString()

        if (this.onPeerSuspected) {
          this.onPeerSuspected({
            peerId,
            timeSinceLastHeartbeat,
            lastHeartbeat: record.lastHeartbeat.toISOString(),
          })
        }
      }
    }
  }

  // Inicia monitoramento periódico de um peer.
  // Verifica a cada heartbeatInterval se responde.
  startMonitoring(peerId) {
    if (!peerId) return

    if (this.intervalHandles.has(peerId)) {
      return
    }

    const handle = setInterval(() => {
      this.checkPeer(peerId)
    }, this.heartbeatInterval)

    this.intervalHandles.set(peerId, handle)
  }

  // Para o monitoramento de um peer.
  stopMonitoring(peerId) {
    if (!peerId) return

    const handle = this.intervalHandles.get(peerId)
    if (handle) {
      clearInterval(handle)
      this.intervalHandles.delete(peerId)
    }
  }

  // Retorna o status de um peer.
  getPeerStatus(peerId) {
    return this.peerHeartbeats.get(peerId) || null
  }

  // Retorna lista de todos os peers suspeitos/offline.
  getSuspectedPeers() {
    return Array.from(this.peerHeartbeats.values()).filter(r => r.status === 'suspected')
  }

  // Retorna lista de todos os peers vivos.
  getAlivePeers() {
    return Array.from(this.peerHeartbeats.values()).filter(r => r.status === 'alive')
  }

  reset() {
    this.intervalHandles.forEach((handle) => clearInterval(handle))
    this.intervalHandles.clear()
    this.peerHeartbeats.clear()
  }
}

module.exports = FailureDetector
