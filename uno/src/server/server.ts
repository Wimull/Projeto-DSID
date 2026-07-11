//Código de entrada do servidor

import serverHandlers from './server-handlers'
import ipc from './server-ipc'

let isDev, version

if (process.argv[2] === '--subprocess') {
    isDev = false

    const socketName = process.argv[4]
    ipc.init(socketName, serverHandlers as any)
} else {
    isDev = true
}

console.log(isDev)
