import ipc from 'node-ipc'

function init(
    socketName: string,
    handlers: { [key: string]: (...args: any[]) => Promise<any> }
) {
    ipc.config.id = socketName
    ipc.config.silent = true

    ipc.serve(() => {
        ipc.server.on('connect', (socket) => {
            ipc.server.emit(
                socket,
                'message',
                JSON.stringify({ type: 'push', name: 'ready', args: [] })
            )
        })
        ipc.server.on('message', (data, socket) => {
            const msg = JSON.parse(data)
            const { id, name, args } = msg

            if (name in Object.keys(handlers)) {
                handlers[name](args).then(
                    (result) => {
                        ipc.server.emit(
                            socket,
                            'message',
                            JSON.stringify({ type: 'reply', id, result })
                        )
                    },
                    (error) => {
                        // Up to you how to handle errors, if you want to forward
                        // them, etc
                        ipc.server.emit(
                            socket,
                            'message',
                            JSON.stringify({ type: 'error', id })
                        )
                        throw error
                    }
                )
            } else {
                console.warn('Unknown method: ' + name)
                ipc.server.emit(
                    socket,
                    'message',
                    JSON.stringify({ type: 'reply', id, result: null })
                )
            }
        })
    })

    ipc.server.start()
}

function send(name: string, args: any[]) {
    ipc.server.broadcast(
        'message',
        JSON.stringify({ type: 'push', name, args })
    )
}

export default { init, send }
