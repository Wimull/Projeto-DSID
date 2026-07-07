// leader-election.js
// Módulo de eleição de líder para arquitetura P2P conforme a wiki.
// Implementa um algoritmo simples de eleição "em corrente" onde o nó com maior ID é eleito líder.

class LeaderElection {
  constructor(localPeerId = null) {
    this.localPeerId = localPeerId
    this.activePeers = new Set()
    this.currentLeader = null
    this.electionInProgress = false
    this.onLeaderChanged = null
  }

  setLocalPeerId(localPeerId) {
    this.localPeerId = localPeerId
    if (this.activePeers.size === 0 && localPeerId) {
      this.activePeers.add(localPeerId)
    }
  }

  // Registra um nó como ativo na partida.
  // Todos os nós ativos participam potencialmente da eleição.
  registerPeer(peerId) {
    if (!peerId) return

    const wasEmpty = this.activePeers.size === 0
    this.activePeers.add(peerId)

    // Sempre recalcula o líder quando um novo peer é adicionado,
    // pois pode ser necessário eleger um novo líder se o novo peer tem ID maior.
    this.electNewLeader()
  }

  // Remove um nó da lista de ativos e dispara re-eleição se for o líder.
  // Simulado em caso de desconexão.
  unregisterPeer(peerId) {
    if (!peerId) return

    this.activePeers.delete(peerId)

    if (this.currentLeader === peerId) {
      this.handleLeaderFailure()
    }
  }

  // Algoritmo de eleição em corrente:
  // Elege como líder o nó com o maior ID entre os nós ativos.
  // Isso garante determinismo: todos os nós chegarão à mesma conclusão.
  electNewLeader() {
    if (this.activePeers.size === 0) {
      this.currentLeader = null
      return
    }

    const sortedPeers = Array.from(this.activePeers).sort()
    const newLeader = sortedPeers[sortedPeers.length - 1]

    if (newLeader !== this.currentLeader) {
      const oldLeader = this.currentLeader
      this.currentLeader = newLeader

      if (this.onLeaderChanged) {
        this.onLeaderChanged({
          oldLeader,
          newLeader,
          isLocalLeader: newLeader === this.localPeerId,
        })
      }
    }
  }

  // Trata falha do líder atual.
  // Quando o líder é detectado como offline (desconexão ou timeout),
  // dispara uma nova eleição automaticamente.
  // Se não há quórum suficiente, a partida deve ser cancelada.
  handleLeaderFailure() {
    if (this.currentLeader) {
      this.activePeers.delete(this.currentLeader)
    }

    this.electionInProgress = true

    if (this.activePeers.size === 0) {
      this.currentLeader = null
      if (this.onLeaderChanged) {
        this.onLeaderChanged({
          oldLeader: this.currentLeader,
          newLeader: null,
          isLocalLeader: false,
          reason: 'no-peers-available',
        })
      }
    } else {
      this.electNewLeader()
    }

    this.electionInProgress = false
  }

  getCurrentLeader() {
    return this.currentLeader
  }

  isLocalLeader() {
    return this.currentLeader === this.localPeerId
  }

  getActivePeers() {
    return Array.from(this.activePeers).sort()
  }

  getPeerCount() {
    return this.activePeers.size
  }

  reset() {
    this.activePeers.clear()
    this.currentLeader = null
    this.electionInProgress = false
  }
}

module.exports = LeaderElection
