export type Card = {id: string, card: string}

export type Game = {deck: Card[], players: ServerSidePlayer[], playedCard: Card, selectedColor: "blue" | "red" | "green" | "yellow", playerTurnId: "", playOrder: "up" | "down"}

export type Player =         {
    name: string,
    id: string,
    hand: Card[],
    isHost: boolean,
    isUser?: boolean
    isReady: boolean
}
export type Player =         {
    name: string,
    id: string,
    hand: Card[],
    isHost: boolean,
    isUser?: boolean
    isReady: boolean
}
export type ServerSidePlayer = Player & {
	actionDecision: "pass" | "notPass" | "null";
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
export type Message =
| {
		messageNum: number;
		type: "Connect";
		data: {
			player: ServerSidePlayer;
		};
  } |
  {
	messageNum: number;
	type: "TryConnect";
	data: {
		player: ServerSidePlayer;
	};
}  | {
messageNum: number;
type: "ConnectionAccepted";
data: {
	players: ServerSidePlayer[];
};
} | {
messageNum: number;
type: "ConnectionDenied";
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
		data: Game;
  }
| {
		messageNum: number;
		type: "EndGame";
		data: { };
  }
|
{
	messageNum: number;
	type: "Action";
	data: {
		player: ServerSidePlayer,
		actionType: "draw",
		cardDrawn: Card,
		playerTurnId: string
	} | {
		player: ServerSidePlayer,
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
		player: ServerSidePlayer,
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
	data: { player: ServerSidePlayer };
}
| {
	messageNum: number;
	type: "Error";
	data: {
		player: ServerSidePlayer | null;
		error: Error;
	};
} | {
	messageNum: number;
	type: "PlayerReadyStartGame";
	data: { player: ServerSidePlayer };
}
| {
	messageNum: number;
	type: "PlayerCancelReadyStartGame";
	data: { player: ServerSidePlayer };
} 
