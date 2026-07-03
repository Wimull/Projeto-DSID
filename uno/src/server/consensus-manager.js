// consensus-manager.js
// Módulo de gerenciamento de consenso para ações distribuídas.
// O objetivo é coletar respostas de pares e aplicar o estado apenas quando houver consenso.

class ConsensusManager {
  constructor(gameState, localPeerId = 'local', peerIds = []) {
    this.gameState = gameState
    this.localPeerId = localPeerId
    this.peerIds = Array.from(new Set(peerIds))
    this.pending = new Map()
  }

  setLocalPeer(localPeerId) {
    this.localPeerId = localPeerId
  }

  setPeerIds(peerIds = []) {
    this.peerIds = Array.from(new Set(peerIds))
  }

  getExpectedResponseCount() {
    const localCount = this.localPeerId ? 1 : 0
    return Math.max(1, this.peerIds.length + localCount)
  }

  createProposal(actionMessage, originPeerId) {
    const key = this.getProposalKey(actionMessage.seq)
    if (this.pending.has(key)) {
      return this.pending.get(key)
    }

    const proposal = {
      key,
      message: actionMessage,
      originPeerId: originPeerId || this.localPeerId,
      status: 'pending',
      responses: {},
      executed: false,
    }

    this.pending.set(key, proposal)
    return proposal
  }

  getProposalKey(seq) {
    return String(seq)
  }

  registerResponse(seq, peerId, accepted, reason) {
    const key = this.getProposalKey(seq)
    const proposal = this.pending.get(key)
    if (!proposal) {
      return { known: false }
    }

    if (!peerId) {
      peerId = 'unknown-peer'
    }

    proposal.responses[peerId] = {
      accepted: Boolean(accepted),
      reason: reason || null,
      timestamp: new Date().toISOString(),
    }

    if (proposal.status !== 'pending') {
      return {
        known: true,
        finalized: true,
        accepted: proposal.status === 'committed',
      }
    }

    if (Object.keys(proposal.responses).length < this.getExpectedResponseCount()) {
      return {
        known: true,
        finalized: false,
      }
    }

    const allAgree = Object.values(proposal.responses).every(r => r.accepted)
    if (allAgree) {
      this.commitProposal(proposal)
      proposal.status = 'committed'
      return {
        known: true,
        finalized: true,
        accepted: true,
      }
    }

    proposal.status = 'aborted'
    return {
      known: true,
      finalized: true,
      accepted: false,
    }
  }

  registerLocalVote(seq, accepted, reason) {
    return this.registerResponse(seq, this.localPeerId, accepted, reason)
  }

  commitProposal(proposal) {
    this.gameState.applyAction(proposal.message)
  }

  getProposal(seq) {
    return this.pending.get(this.getProposalKey(seq))
  }

  reset() {
    this.pending.clear()
  }
}

module.exports = ConsensusManager
