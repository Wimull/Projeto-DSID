//Código de entrada do servidor

import serverHandlers from './server-handlers'
import ipc from './server-ipc'
import net from "node:net";

import { onClientError, onMessage } from "./callbacks.js";
import { v4 as uuid } from "uuid";

export const PORT = parseInt(Math.round(Math.random() * 1000));

let isDev, version

if (process.argv[2] === '--subprocess') {
    isDev = false

    const socketName = process.argv[4]
    ipc.init(socketName, serverHandlers(PORT) as any)
} else {
    isDev = true
}

console.log(isDev)



const connections: Map<string, net.Socket> = new Map([]);

function sendMessage(data: string, port: number, address: string) {
	console.log(`sending message ${data} to ${address}:${port}`);
	const socket = connections.get(`${address}:${port}`);
	if (socket) {
		socket.write(data);
	}
}
const server = net.createServer();


function connect(port: number, address: string){
    const client = new net.Socket()
    console.log("Connected to " + address + ":" + port)

    client.connect(parseInt(port), address, () => {
        connections.set(`${address}:${port}`, client)
    })
	connectionSocket.on("data", (data) => {
		console.log("message received");
		onMessage(data.toString(), address, port, sendMessage);
	});

    client.on("close", () => {
		connections.delete(`${address}:${port}`);
        console.log("Connection closed");
    });
    client.on("end", () => {
		connections.delete(`${address}:${port}`);
        console.log("Connection ended");
    });
    
    // Handle errors
	client.on("error", (err) => {
		onClientError(err,  address, port,sendMessage);
		connections.delete(`${address}:${port}`);
		client.end();
	});
}

server.on("connection", (connectionSocket) => {
	const id = uuid();
	console.log("client connected");

	connections.set(`${id}:${0}`, connectionSocket);

	connectionSocket.on("data", (data) => {
		console.log("message received");
		onMessage(data.toString(), id, 0, sendMessage);
	});
	connectionSocket.on("error", (err) => {
		onClientError(err, id, 0, sendMessage);
        ipc.send({name: "error", type: "push", args: {data: {type: "error", message: err.stack}}})
		connections.delete(`${id}:${0}`);
		connectionSocket.end();
	});

	connectionSocket.on("end", () => {
		connections.delete(`${id}:${0}`);
		connectionSocket.end();
		console.log("client disconnected");
	});
});

server.on("error", (err) => {
	console.error(`server error:\n${err.stack}`);
    ipc.send({name: "error", type: "push", args: {data: {type: "error", message: err.stack}}})
	server.close();
});

server.on("close", () => {
	console.log("server closed");
});
server.on("listening", () => {
	const address = server.address();
	console.log(
		`server listening on ${
			address && typeof address === "object" ? address.address : address
		}:${PORT}`
	);
});

server.listen(PORT);