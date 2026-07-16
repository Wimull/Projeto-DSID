// Init
async function init() {
    //@ts-ignore
    const socketName = await window.getServerSocket()
    connectSocket(socketName, () => {
        console.log('Connected!')
    })
}

init()

// State
const replyHandlers = new Map()
const listeners: Map<string, ((args: any) => void)[]> = new Map()
let messageQueue: any[] = []
let socketClient: any = null

// Functions

function connectSocket(name: string, onOpen: () => void) {
    //@ts-ignore
    window.ipcConnect(name, function (client, on) {
        on([
            [
                'message',
                (data: string) => {
                    const msg = JSON.parse(data)
                    console.log('received message', msg)
                    if (msg.type === 'error') {
                        // Up to you whether or not to care about the error
                        const { id } = msg
                        replyHandlers.delete(id)
                    } else if (msg.type === 'reply') {
                        const { id, result } = msg

                        const handler = replyHandlers.get(id)
                        if (handler) {
                            replyHandlers.delete(id)
                            handler.resolve(result)
                        }
                    } else if (msg.type === 'push') {
                        const { name, args } = msg

                        const listens = listeners.get(name)
                        if (listens) {
                            listens.forEach((listener) => {
                                listener(args)
                            })
                        }
                    } else {
                        throw new Error(
                            'Unknown message type: ' + JSON.stringify(msg)
                        )
                    }
                },
            ],
            [
                'connect',
                () => {
                    socketClient = client

                    // Send any messages that were queued while closed
                    if (messageQueue.length > 0) {
                        messageQueue.forEach((msg) =>
                            socketClient.emit('message', msg)
                        )
                        messageQueue = []
                    }
                    onOpen()
                },
            ],

            [
                'disconnect',
                () => {
                    socketClient = null
                },
            ],
        ])
    })
}

function send(name: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
        //@ts-ignore
        const id = window.uuid.v4()
        replyHandlers.set(id, { resolve, reject })
        if (socketClient) {
            socketClient.emit('message', JSON.stringify({ id, name, args }))
        } else {
            messageQueue.push(JSON.stringify({ id, name, args }))
        }
    })
}

function listen(name: string, cb: (args: any) => void) {
    if (!listeners.get(name)) {
        listeners.set(name, [])
    }
    listeners.get(name)!.push(cb)

    return () => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const arr = listeners.get(name)!
        listeners.set(
            name,
            arr.filter((cb_) => cb_ !== cb)
        )
    }
}

function unlisten(name: string) {
    listeners.set(name, [])
}
