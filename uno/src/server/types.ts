export type Card = { id: string; card: string }

export type Game = {
    deck: Card[]
    players: ServerSidePlayer[]
    playedCard: Card
    selectedColor: 'blue' | 'red' | 'green' | 'yellow'
    playerTurnId: string
    playOrder: 'up' | 'down'
    seed: number
    random: () => number
}

export type Player = {
    name: string
    id: string
    hand: Card[]
    isHost: boolean
    isUser?: boolean
    isReady: boolean
}
export type ServerSidePlayer = Player & {
    actionDecision: 'pass' | 'notPass' | 'null'
    clientFakeId: string
    address: string
    port: number
    serverId: string
    timeoutKeepAlive: number
    timeoutEndConnection: number
    messagesSentWithoutACK: {
        resend: (resendTimeout: number, messageNum: number) => void
        messageNum: number
        timeout: number
    }[]
}
export type Message =
    | {
          messageNum: number
          type: 'Connect'
          data: {
              player: ServerSidePlayer
          }
      }
    | {
          messageNum: number
          type: 'TryConnect'
          data: {
              player: ServerSidePlayer
          }
      }
    | {
          messageNum: number
          type: 'ConnectionAccepted'
          data: {
              player: ServerSidePlayer
              players: ServerSidePlayer[]
          }
      }
    | {
          messageNum: number
          type: 'ConnectionDenied'
          data: {
              player: ServerSidePlayer
          }
      }
    | {
          messageNum: number
          type: 'KeepAlive'
          data: { player: Player }
      }
    | {
          messageNum: number
          type: 'ACK'
          data: {
              player: Player
          }
      }
    | {
          messageNum: number
          type: 'StartGame'
          data: Game & { player: Player }
      }
    | {
          messageNum: number
          type: 'EndGame'
          data: { player: ServerSidePlayer }
      }
    | {
          messageNum: number
          type: 'Action'
          data:
              | {
                    player: ServerSidePlayer
                    actionType: 'draw'
                    cardDrawn: Card
                    playerTurnId: string
                    game: Game
                }
              | {
                    player: ServerSidePlayer
                    actionType: 'playCard'
                    cardPlayed: Card
                    selectedColor?: 'blue' | 'red' | 'green' | 'yellow'
                    playerTurnId: string
                    game: Game
                }
      }
    | {
          messageNum: number
          type: 'ActionDecision'
          data: {
              player: ServerSidePlayer
              doesPass: boolean
          }
      }
    | {
          messageNum: number
          type: 'ActionPassed'
          data: { player: ServerSidePlayer } & (
              | {
                    actionType: 'draw'
                    cardDrawn: Card
                    playerTurnId: string
                }
              | {
                    actionType: 'playCard'
                    cardPlayed: Card
                    selectedColor?: 'blue' | 'red' | 'green' | 'yellow'
                    playerTurnId: string
                }
          )
      }
    | {
          messageNum: number
          type: 'ActionDenied'
          data: { player: ServerSidePlayer } & (
              | {
                    actionType: 'draw'
                    playerTurnId: string
                }
              | {
                    actionType: 'playCard'
                    playerTurnId: string
                }
          )
      }
    | {
          messageNum: number
          type: 'Error'
          data: {
              error: Error
          }
      }
    | {
          messageNum: number
          type: 'Disconnect'
          data: { player: ServerSidePlayer }
      }
    | {
          messageNum: number
          type: 'Error'
          data: {
              player: ServerSidePlayer | null
              error: Error
          }
      }
    | {
          messageNum: number
          type: 'PlayerReadyStartGame'
          data: { player: ServerSidePlayer }
      }
    | {
          messageNum: number
          type: 'PlayerCancelReadyStartGame'
          data: { player: ServerSidePlayer }
      }
