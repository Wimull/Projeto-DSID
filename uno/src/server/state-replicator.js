// state-replicator.js
// Módulo de replicação de estado para sincronização entre pares.
// Implementa "Distribuição Estática" conforme wiki: cada nó recebe estado inicial completo.

class StateReplicator {
  constructor(gameState, consensusManager) {
    this.gameState = gameState
    this.consensusManager = consensusManager
    this.lastReplicatedSeq = 0
    this.onStateRequest = null
    this.onStateSync = null
  }

  // Prepara o estado completo para envio a um novo peer.
  // Inclui baralho, descarte, mãos, histórico de ações.
  getStateSnapshot() {
    const state = this.gameState.getState()

    return {
      version: 1,
      timestamp: new Date().toISOString(),
      roomID: state.roomID,
      playerID: state.playerID,
      leader: state.leader,
      status: state.status,
      deck: state.deck.slice(),
      discard: state.discard.slice(),
      hands: JSON.parse(JSON.stringify(state.hands)),
      turnOrder: state.turnOrder.slice(),
      currentTurn: state.currentTurn,
      lastSeq: state.lastSeq,
      history: state.history.slice(),
    }
  }

  // Aplica um estado recebido de outro peer.
  // Valida consistência antes de aplicar.
  applyStateSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 1) {
      throw new Error('Invalid snapshot version')
    }

    if (snapshot.roomID !== this.gameState.getState().roomID) {
      throw new Error('Snapshot is from different room')
    }

    // Valida que o snapshot tem seq maior que o local
    if (snapshot.lastSeq < this.gameState.getState().lastSeq) {
      throw new Error('Snapshot is outdated')
    }

    // Replica completa: modifica o estado interno diretamente
    // Acessar this.gameState.state para não receber uma cópia
    this.gameState.state.deck = snapshot.deck
    this.gameState.state.discard = snapshot.discard
    this.gameState.state.hands = JSON.parse(JSON.stringify(snapshot.hands))
    this.gameState.state.turnOrder = snapshot.turnOrder.slice()
    this.gameState.state.currentTurn = snapshot.currentTurn
    this.gameState.state.lastSeq = snapshot.lastSeq
    this.gameState.state.history = snapshot.history.slice()

    this.lastReplicatedSeq = snapshot.lastSeq

    if (this.onStateSync) {
      this.onStateSync({
        roomID: snapshot.roomID,
        seq: snapshot.lastSeq,
        timestamp: snapshot.timestamp,
      })
    }

    return true
  }

  // Sincroniza histórico de ações a partir de uma seq específica.
  // Usada para recuperação após desconexão/reconexão.
  getHistorySince(sinceSeq) {
    const state = this.gameState.getState()
    return state.history.filter(entry => entry.seq > sinceSeq)
  }

  // Valida se dois estados são consistentes.
  // Compara seq e lastResult para detectar divergências.
  validateStateConsistency(remoteState) {
    const localState = this.gameState.getState()

    if (remoteState.roomID !== localState.roomID) {
      return {
        consistent: false,
        reason: 'different-room',
      }
    }

    if (remoteState.lastSeq !== localState.lastSeq) {
      return {
        consistent: false,
        reason: 'seq-mismatch',
        local: localState.lastSeq,
        remote: remoteState.lastSeq,
      }
    }

    return {
      consistent: true,
    }
  }

  // Detecta divergência de estado (falha do líder).
  // Se informação recebida é incompatível com estado local, marca líder como suspeito.
  detectLeaderInconsistency(remoteState) {
    const consistency = this.validateStateConsistency(remoteState)

    if (!consistency.consistent) {
      return {
        inconsistency: consistency.reason,
        shouldElectNewLeader: true,
        details: consistency,
      }
    }

    return {
      inconsistency: null,
      shouldElectNewLeader: false,
    }
  }

  reset() {
    this.lastReplicatedSeq = 0
  }
}

module.exports = StateReplicator
