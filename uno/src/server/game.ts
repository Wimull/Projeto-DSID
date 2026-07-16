import type {
	ServerSidePlayer,
	Card,
	Game,
	ServerSidePlayer
} from "./types.ts";

import {v4 as uuid} from "uuid"

export const user: ServerSidePlayer = {

}

export let game: Game  = {
	deck: [],
	players: [],
	playedCard: {
		id: "",
		card: ""
	},
	selectedColor: "blue",
	playerTurnId: "",
	playOrder: "up"
}

export const connectedPlayersList: Map<string, ServerSidePlayer> = new Map([]);


export function connectPlayer(player: ServerSidePlayer){
	connectedPlayersList.set(player.id, player)
}

export function disconnectPlayer(playerId: string){
	connectedPlayersList.delete(playerId)
	if(game.players.length > 0){

		const player = game.players[game.players.findIndex(p => p.id === playerId)]
		game.players.filter(p => p.id !== playerId)
		if (game.playerTurnId === playerId) {
			goNextTurn()
		}
		return game
	}
}


export function startGame(players: ServerSidePlayer[], starterGame?: Game){
	if (starterGame) {
		game = starterGame
		return game
	}
	let deck = [
		"blue0",
		"blue1",
		"blue1",
		"blue2",
		"blue2",
		"blue3",
		"blue3",
		"blue4",
		"blue4",
		"blue5",
		"blue5",
		"blue6",
		"blue6",
		"blue7",
		"blue7",
		"blue8",
		"blue8",
		"blue9",
		"blue9",
		"blueStop",
		"blueStop",
		"blueReverse",
		"blueReverse",
		"bluePlus2",
		"bluePlus2",
	
		"green0",
		"green1",
		"green1",
		"green2",
		"green2",
		"green3",
		"green3",
		"green4",
		"green4",
		"green5",
		"green5",
		"green6",
		"green6",
		"green7",
		"green7",
		"green8",
		"green8",
		"green9",
		"green9",
		"greenStop",
		"greenStop",
		"greenReverse",
		"greenReverse",
		"greenPlus2",
		"greenPlus2",
	
		"red0",
		"red1",
		"red1",
		"red2",
		"red2",
		"red3",
		"red3",
		"red4",
		"red4",
		"red5",
		"red5",
		"red6",
		"red6",
		"red7",
		"red7",
		"red8",
		"red8",
		"red9",
		"red9",
		"redStop",
		"redStop",
		"redReverse",
		"redReverse",
		"redPlus2",
		"redPlus2",
	
		"yellow0",
		"yellow1",
		"yellow1",
		"yellow2",
		"yellow2",
		"yellow3",
		"yellow3",
		"yellow4",
		"yellow4",
		"yellow5",
		"yellow5",
		"yellow6",
		"yellow6",
		"yellow7",
		"yellow7",
		"yellow8",
		"yellow8",
		"yellow9",
		"yellow9",
		"yellowStop",
		"yellowStop",
		"yellowReverse",
		"yellowReverse",
		"yellowPlus2",
		"yellowPlus2",
	
		"wild",
		"wild",
		"wild",
		"wild",
		"wild4",
		"wild4",
		"wild4",
		"wild4"
	  ]
	  while(deck[deck.length - 1].startsWith("wild")){

		  deck = deck.sort((a, b) => 0.5 - Math.random())
		}
	game.deck = deck.map((card) => ({
		id: uuid(),
		card
	}))
	game.playedCard = game.deck.pop()
	game.selectedColor = game.playedCard.card.startsWith("blue") ? "blue" : game.playedCard.card.startsWith("green") ? "green" : game.playedCard.card.startsWith("yellow") ? "yellow" : "red"
	game.players = players.map(p => {
		p.hand = []
		for(let i = 0; i < 7; i++){
			p.hand.push(game.deck.pop())
		}
		return p
	})
	game.playerTurnId = players[Math.round(Math.random() * 10) % 4].id
	game.playOrder = "up"
	return game
}
export function goNextTurn(newGame: Game, skipNumber: number = 0){

	let index = newGame.players.findIndex(p => p.id === newGame.playerTurnId)
	newGame.playerTurnId = newGame.players[(newGame.playOrder === "up" ? index + 1 + skipNumber : index - (1 + skipNumber)) % newGame.players.length]
	game = newGame
}

export function playCard(playerId: string, {card, id: cardId}: Card, selectedColor?: "blue" | "red" | "green" | "yellow") {
	const newGame: Game = {
		deck: game.deck.map(c => ({...c})),
		playedCard: {...game.playedCard},
		players: game.players.map(p => ({
			...p,
			hand: p.hand.map(c => ({...c}))
		})),
		playerTurnId: game.playerTurnId,
		playOrder: game.playOrder,
		selectedColor: game.selectedColor
	}
	const player = newGame.players[newGame.players.findIndex(p => p.id === playerId)]
	player.hand.filter(c => c.id !== cardId)
	newGame.selectedColor = selectedColor ?? (card.startsWith("blue") ? "blue" : card.startsWith("green") ? "green" : card.startsWith("yellow") ? "yellow" : "red")
	if (card.includes("Plus2")){
		let index = newGame.players.findIndex(p => p.id === newGame.playerTurnId)
	 const playerToDraw = newGame.players(newGame.playOrder === "up" ? index + 1 : index - (1)) % newGame.players.length	
	 for(let i = 0; i < 2; i++){
		playerToDraw.push(newGame.deck.pop())
	 }
	 return {game: newGame, doNextTurn: () => goNextTurn(newGame, 1)}
	}
	else if (card.includes("wild4")){
		let index = newGame.players.findIndex(p => p.id === newGame.playerTurnId)
	 const playerToDraw = newGame.players(newGame.playOrder === "up" ? index + 1 : index - (1)) % newGame.players.length	
	 for(let i = 0; i < 4; i++){
		playerToDraw.push(newGame.deck.pop())
	 }
	 return {game: newGame, doNextTurn: () =>  goNextTurn(newGame, 1)}
	}
	else if(card.includes("Stop")){
		return {game: newGame, doNextTurn: () =>  goNextTurn(newGame, 1)}
	} 
	else if(card.includes("Reverse")){
		newGame.playOrder = newGame.playOrder === "up" ? "down" : "up"
		return {game: newGame, doNextTurn: () =>  goNextTurn(newGame)}
	}
	else {
		return {game: newGame, doNextTurn: () => goNextTurn(newGame)}
	}
}


export function drawCard(playerId: string) {
	const newGame: Game = {
		deck: game.deck.map(c => ({...c})),
		playedCard: {...game.playedCard},
		players: game.players.map(p => ({
			...p,
			hand: p.hand.map(c => ({...c}))
		})),
		playerTurnId: game.playerTurnId,
		playOrder: game.playOrder,
		selectedColor: game.selectedColor
	}
	const player = newGame.players[newGame.players.findIndex(p => p.id === playerId)]
	const cardDrawn = newGame.deck.pop()
	player.hand.push(cardDrawn)
	return {cardDrawn, game: newGame, doNextTurn: () => goNextTurn()}
}

export function validateAction(action: {
	type: "draw",
	player: ServerSidePlayer,
	cardDrawn: Card,
	nextPlayerTurnId: string,
} | {
	type: "play",
	player: ServerSidePlayer,
	selectedColor?: "blue" | "green" | "red" | "yellow",
	nextPlayerTurnId: string,
	card: Card 
}) {
	let index = game.players.findIndex(p => p.id === game.playerTurnId)
	if(nextTurnId)
	if(action.type === "draw"){
		if(action.cardDrawn.id === game.deck[game.deck.length - 1].id && action.cardDrawn.card === game.deck[game.deck.length - 1].card){
			const nextTurnId = game.players[(game.playOrder === "up" ? index + 1 + skipNumber : index - (1 + skipNumber)) % game.players.length]
			return nextTurnId === action.nextPlayerTurnId ? true : false
		}
		return false
	} else {
		const player = game.players[game.players.findIndex(p => p.id === action.player.id)]
		const cardIndex = player.hand.findIndex(c => c.id === action.card.id)
		if(cardIndex !== 1 && player[cardIndex].card === action.card.card){
			let order = game.playOrder
			if(action.card.card.includes("Reverse")) order = game.playOrder === "up" ? "down" : "up"
			const nextTurnId = game.players[(order === "up" ? index + 1 + skipNumber : index - (1 + skipNumber)) % game.players.length]
			
			return true
		} return false
	} 
}