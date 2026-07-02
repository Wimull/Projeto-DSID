// message-types.ts
// Tipos de mensagem do protocolo TCP/JSON conforme definido na wiki do projeto.
// Este arquivo define o contrato que todas as mensagens enviadas entre nós devem obedecer.

// O protocolo da wiki padroniza o envelope de mensagem como:
// {
//   "type": "string",
//   "seq": 1,
//   "data": any
// }
// Onde `type` define a categoria da mensagem, `seq` é a sequência lógica positiva
// e `data` contém o payload específico dessa mensagem.

// Tipos de mensagem aceitos pelo protocolo.
export type TcpMessageType =
  | 'action'
  | 'agree'
  | 'disagree'
  | 'keepAlive'
  | 'ACK'
  | 'ERR'

// Estrutura básica de todas as mensagens TCP do protocolo.
export interface TcpMessage<TData = unknown> {
  type: TcpMessageType
  seq: number
  data: TData
}

// Payload de uma mensagem de ação. A wiki trata `action` como comando de jogo
// que deve ser validado e processado pelos pares.
export interface ActionMessageData {
  handler: string
  args?: Record<string, unknown>
}

export type ActionMessage = TcpMessage<ActionMessageData>

// Payload de resposta de consenso, usado para `agree` e `disagree`.
export interface ConsensusReplyData {
  reason?: string
  details?: Record<string, unknown>
}

export type AgreeMessage = TcpMessage<ConsensusReplyData>
export type DisagreeMessage = TcpMessage<ConsensusReplyData>

// Mensagem de keepAlive usada para manter a conexão viva entre pares.
export interface KeepAliveMessageData {
  timestamp: string
}

export type KeepAliveMessage = TcpMessage<KeepAliveMessageData>

// Confirmação de recebimento de mensagem.
export interface AckMessageData {
  status?: string
  result?: unknown
}

export type AckMessage = TcpMessage<AckMessageData>

// Mensagem de erro padronizada para falhas de validação ou execução.
export interface ErrMessageData {
  reason: string
  details?: Record<string, unknown>
}

export type ErrMessage = TcpMessage<ErrMessageData>

// União de todos os tipos de mensagem definidos pela wiki.
export type TcpProtocolMessage =
  | ActionMessage
  | AgreeMessage
  | DisagreeMessage
  | KeepAliveMessage
  | AckMessage
  | ErrMessage

// Mensagens legadas não fazem parte do contrato wiki, mas podem coexistir
// enquanto ocorrer a migração para o protocolo do envelope TCP JSON.
export interface LegacyRequest {
  id: string
  name: string
  args: Record<string, unknown>
}

export type ServerMessage = TcpProtocolMessage | LegacyRequest
