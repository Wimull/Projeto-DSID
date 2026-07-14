import type {
	ServerSidePlayer,
	Category,
	Message,
	Word,
    Card
} from "./types.ts";

import { v4 as uuidv4 } from "uuid";

import {connectedPlayersList} from "./game.ts"

import {PORT} from "./server.ts"


type SocketSendMessage = (
	message: string,
	port: number,
	address: string
) => void;



function sendMessage(
	player: ServerSidePlayer,
	message: Omit<Message, "messageNum">,
	socketSendMessage: SocketSendMessage
) {
	const messageNum =
		player.messagesSentWithoutACK[player.messagesSentWithoutACK.length - 1]
			?.messageNum || 0;

	const resendTimeout = setTimeout(() => {
		player.messagesSentWithoutACK.forEach((m) => {
			if (m.messageNum === messageNum) {
				m.resend(resendTimeout, messageNum);
			}
		});
	}, 1000);
	const send = (resendTimeout: NodeJS.Timeout, messageNum: number) => {
		socketSendMessage(
			JSON.stringify({ ...message, messageNum: messageNum }),
			player.port,
			player.address
		);
		resendTimeout.refresh();
	};
	if (message.type === "ACK") return send(resendTimeout, messageNum);
	player.messagesSentWithoutACK.push({
		resend: send,
		messageNum: messageNum,
		timeout: resendTimeout,
	});
	send(resendTimeout, messageNum);
}

function disconnectPlayer(
	player: ServerSidePlayer,
	socketSendMessage: SocketSendMessage
) {
	clearTimeout(player.timeoutKeepAlive);
	clearTimeout(player.timeoutEndConnection);
	player.messagesSentWithoutACK.forEach((m) => clearTimeout(m.timeout));
	connectedPlayersList.delete(player.id);
	connectedPlayersList.forEach((receivingPlayer) => {
		const res: Omit<Message, "messageNum"> = {
			type: "OtherPlayerDisconnect",
			data: {
				player: {
					name: player.name,
					id: player.clientFakeId,
				},
			},
		};
		sendMessage(receivingPlayer, res, socketSendMessage);
	});
}
let categories: Category[] = [
	"animal",
	"cor",
	"filme",
	"fruta",
	"MSE",
	"nome",
	"pais",
	"trabalho",
];
export function onMessage(
	msg: string,
	address: string,
	port: number,
	socketSendMessage: SocketSendMessage
) {
	const messageJSON: Message = JSON.parse(msg);
	const { data, messageNum: clientMessageNum, type } = messageJSON;
	console.log(`server got a message type ${type} from ${address}:${port}`);

	const letters = [
		"A",
		"B",
		"C",
		"D",
		"E",
		"F",
		"G",
		"H",
		"I",
		"J",
		"K",
		"L",
		"M",
		"N",
		"O",
		"P",
		"Q",
		"R",
		"S",
		"T",
		"U",
		"V",
		"W",
		"X",
		"Y",
		"Z",
	];

	const keepAliveRes: Partial<Message> = {
		type: "KeepAlive",
		data: null,
	};

	const ACKRes: Partial<Message> = {
		type: "ACK",
		messageNum: clientMessageNum,
		data: null,
	};

	function endGame() {
		const leaderboard: { name: string; id: string; points: number }[] = [];
		connectedPlayersList.forEach((player) => {
			leaderboard.push({
				name: player.name,
				id: player.clientFakeId,
				points: player.points,
			});
		});
		leaderboard.sort((a, b) => b.points - a.points);

		if (leaderboard.length > 0) {
			connectedPlayersList.forEach((player) => {
				const res: Omit<Message, "messageNum"> = {
					type: "EndGame",
					data: {
						leaderboard,
					},
				};
				sendMessage(player, res, socketSendMessage);
			});
		}
		connectedPlayersList.forEach((player) => {
			disconnectPlayer(player, socketSendMessage);
		});
		categories = [
			"animal",
			"cor",
			"filme",
			"fruta",
			"MSE",
			"nome",
			"pais",
			"trabalho",
		];
	}

	function tryStartNextRound() {
		let isEveryPlayerReady = true;
		const candidates: Word[] = [];
		const category = categories.shift();
		if (!category) {
			endGame();
			return;
		}
		//Copilot com alterações significativas
		connectedPlayersList.forEach((receivingPlayer) => {
			if (!receivingPlayer.readyNextRound) {
				isEveryPlayerReady = false;
			}
			if (receivingPlayer.words[category])
				candidates.push(receivingPlayer.words[category]);
		});
		if (isEveryPlayerReady) {
			connectedPlayersList.forEach((receivingPlayer) => {
				const res: Omit<Message, "messageNum"> = {
					type: "StartRound",

					data: {
						candidates,
						category,
					},
				};
				sendMessage(receivingPlayer, res, socketSendMessage);
			});
		}
		//Fim do Copilot
	}

	if (type !== "ACK")
		socketSendMessage(JSON.stringify({...ACKRes, data: {...connectedPlayersList.get("localhost:"+PORT)}}), port, address);

	switch (type) {
		case "Connect": {
			const id = uuidv4();
			const player: ServerSidePlayer = {
				id,
				name: data.player.name,
				points: 0,
				words: {
					animal: null,
					cor: null,
					filme: null,
					fruta: null,
					MSE: null,
					nome: null,
					pais: null,
					trabalho: null,
				},
				readyStartGame: false,
				readyNextRound: false,
				clientFakeId: uuidv4(),
				address: address,
				port: port,
				timeoutKeepAlive: setTimeout(() => {
					sendMessage(player, {...keepAliveRes, data: {player}}, socketSendMessage);
				}, 5000),
				timeoutEndConnection: setTimeout(() => {
					disconnectPlayer(player, socketSendMessage);
				}, 15000),
				messagesSentWithoutACK: [],
			};
			const res: Omit<Message, "messageNum"> = {
				type: "Connect",
				data: {
					player: {
						clientFakeId: player.clientFakeId,
						id,
						name: player.name,
						points: player.points,
					},
				},
			};
			sendMessage(player, res, socketSendMessage);
			connectedPlayersList.forEach((receivingPlayer) => {
				const resOthers: Omit<Message, "messageNum"> = {
					type: "OtherPlayerConnect",
					data: {
						player: {
							name: player.name,
							clientFakeId: player.clientFakeId,
						},
					},
				};
				sendMessage(receivingPlayer, resOthers, socketSendMessage);
			});
			connectedPlayersList.set(id, player);

			break;
		}

		case "Disconnect": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) disconnectPlayer(player, socketSendMessage);
			break;
		}

		case "KeepAlive": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) {
				player.timeoutKeepAlive.refresh();
				player.timeoutEndConnection.refresh();
			}
			break;
		}
		case "ACK": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) {
				player.messagesSentWithoutACK =
					player.messagesSentWithoutACK.filter((m) => {
						if (m.messageNum === clientMessageNum) {
							clearTimeout(m.timeout);
						}
						return m.messageNum !== clientMessageNum;
					});
			}
			break;
		}
		case "PlayerReadyStartGame": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) {
				player.readyStartGame = true;
				let isEveryPlayerReady = true;

				// Copilot
				connectedPlayersList.forEach((receivingPlayer) => {
					if (!receivingPlayer.readyStartGame) {
						isEveryPlayerReady = false;
					}
				});
				if (isEveryPlayerReady) {
					connectedPlayersList.forEach((receivingPlayer) => {
						const res: Omit<Message, "messageNum"> = {
							type: "StartGame",
							data: {
								categories,
								chosenLetter:
									letters[
										Math.floor(
											Math.random() * (letters.length - 1)
										)
									] || "A",
							},
						};
						sendMessage(receivingPlayer, res, socketSendMessage);
					});
				}
				//Fim do Copilot
			}
			break;
		}
		case "PlayerCancelReadyStartGame": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) {
				player.readyStartGame = false;
			}
			break;
		}
		case "PlayerStopCall": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) {
				connectedPlayersList.forEach((receivingPlayer) => {
					const res: Omit<Message, "messageNum"> = {
						type: "StopCall",
						data: {
							player: {
								name: player.name,
								clientFakeId: player.clientFakeId,
							},
						},
					};
					sendMessage(receivingPlayer, res, socketSendMessage);
				});
			}
			break;
		}
		case "PlayerWords": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) {
				player.words = data.player.words;
				player.readyNextRound = true;

				tryStartNextRound();
			}
			break;
		}
		case "PlayerVotedWords":
			data.votedWords.forEach((word) => {
				const votedPlayer = connectedPlayersList
					.values()
					.toArray()
					.find(
						(p) =>
							Object.values(p.words).findIndex(
								(w) => w?.id === word.id
							) !== -1
					);
				if (votedPlayer) {
					votedPlayer.points = votedPlayer.points + 10;
				}
			});
			break;
		case "PlayerReadyNextRound": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) {
				player.readyNextRound = true;
				tryStartNextRound();
			}
			break;
		}
		case "PlayerCancelReadyNextRound": {
			const player = connectedPlayersList.get(data.player.id);
			if (player) {
				player.readyNextRound = false;
			}
			break;
		}
		case "Error": {
			break;
		}
		default:
			console.log("Unknown message");
	}
	if (
		data &&
		type !== "Error" &&
		type !== "Connect" &&
		type !== "Disconnect"
	) {
		connectedPlayersList.get(data.player.id)?.timeoutKeepAlive.refresh();
		connectedPlayersList
			.get(data.player.id)
			?.timeoutEndConnection.refresh();
	}
}

export function onClientError(
	err: Error,
	address: string,
	port: number,
	socketSendMessage: SocketSendMessage
) {
	console.error(`client error:\n${err.stack}`);
	let player: ServerSidePlayer | undefined = undefined;
	connectedPlayersList.forEach((receivingPlayer) => {
		if (
			receivingPlayer.address === address &&
			receivingPlayer.port === port
		) {
			player = receivingPlayer;
		}
	});
	if (!player) {
		return;
	}
	disconnectPlayer(player, socketSendMessage);
	console.log(
		`client ${address}:${port}, name: ${
			(player as ServerSidePlayer).name
		} disconnected`
	);
}