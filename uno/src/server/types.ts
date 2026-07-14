export type Card = {id: string, card: string}


export type Player =         {
    name: string,
    id: string,
    hand: Card[],
    isHost: boolean,
    isUser?: boolean
    isReady: boolean
}

export type Word = {
	id: string;
	word: string;
};
export type Category =
	| "animal"
	| "cor"
	| "filme"
	| "fruta"
	| "nome"
	| "pais"
	| "trabalho"
	| "MSE";


export type ServerSidePlayer = Player & {
	clientFakeId: string;
	address: string;
	port: number;
	timeoutKeepAlive: NodeJS.Timeout;
	timeoutEndConnection: NodeJS.Timeout;
	messagesSentWithoutACK: {
		resend: (resendTimeout: NodeJS.Timeout, messageNum: number) => void;
		messageNum: number;
		timeout: NodeJS.Timeout;
	}[];
};
export type Messages =
	| {
			messageNum: number;
			type: "Connect";
			data: {
				player: ServerSidePlayer;
			};
	  }
      | {
        messageNum: number;
        type: "KeepAlive";
        data: { player: Player };
  }
| {
        messageNum: number;
        type: "ACK";
        data: {
            player: Player;
        };
  } | {
			messageNum: number;
			type: "StartGame";
			data: { players: ServerSidePlayer[], deck: Card[] };
	  }
	| {
			messageNum: number;
			type: "EndGame";
			data: { leaderboard: Omit<Player, "words">[] };
	  }
	|
    {
        messageNum: number;
        type: "Action";
        data: {
            actionType: "draw",
            cardDrawn: Card,
            playerTurnId: string
        } | {
            actionType: "playCard",
            cardPlayed: Card,
            selectedColor?: "blue" | "red" | "green" | "yellow",
            playerTurnId: string
        }
    } |
    {
        messageNum: number;
        type: "ActionDecision";
        data: {
        doesPass: boolean
        }
    } |
    {
        messageNum: number;
        type: "ActionPassed";
        data: {
            actionType: "draw",
            cardDrawn: Card,
            playerTurnId: string
        } | {
            actionType: "playCard",
            cardPlayed: Card
            selectedColor?: "blue" | "red" | "green" | "yellow",
            playerTurnId: string
        }
    } | {
        messageNum: number;
        type: "ActionDenied";
        data: {
            actionType: "draw",

            playerTurnId: string
        } | {
            actionType: "playCard",
            playerTurnId: string
        }
    }
    | {
			messageNum: number;
			type: "Error";
			data: {
				error: Error;
			};
	  }	| {
        messageNum: number;
        type: "Disconnect";
        data: { player: Player };
  }
| {
        messageNum: number;
        type: "Error";
        data: {
            player: Player | null;
            error: Error;
        };
  }
      

export type MessageReceived =
	| {
			messageNum: number;
			type: "Connect";
			data: { player: Pick<Player, "name"> };
	  }
	| {
			messageNum: number;
			type: "KeepAlive";
			data: { player: Player };
	  }
	| {
			messageNum: number;
			type: "ACK";
			data: {
				player: Player;
			};
	  }
	| {
			messageNum: number;
			type: "PlayerReadyStartGame";
			data: { player: Player };
	  }
	| {
			messageNum: number;
			type: "PlayerCancelReadyStartGame";
			data: { player: Player };
	  }
	| {
			messageNum: number;
			type: "PlayerStopCall";
			data: { player: Player };
	  }
	| {
			messageNum: number;
			type: "PlayerWords";
			data: { player: Player };
	  }
	| {
			messageNum: number;
			type: "PlayerVotedWords";
			data: { player: Player; votedWords: Word[] };
	  }
	| {
			messageNum: number;
			type: "PlayerReadyNextRound";
			data: { player: Player };
	  }
	| {
			messageNum: number;
			type: "PlayerCancelReadyNextRound";
			data: { player: Player };
	  }
;