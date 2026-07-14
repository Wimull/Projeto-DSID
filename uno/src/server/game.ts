import type {
	ServerSidePlayer,
	MessageReceived,
	Category,
	MessageSent,
	Word,
} from "./types.ts";

export const connectedPlayersList: Map<string, ServerSidePlayer> = new Map([]);