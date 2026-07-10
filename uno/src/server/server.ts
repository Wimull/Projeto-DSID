//Código de entrada do servidor

import serverHandlers from './server-handlers'
import ipc from './server-ipc'
import { ipcRenderer } from 'electron'

let isDev, version

if (process.argv[2] === '--subprocess') {
  isDev = false


  const socketName = process.argv[4]
  ipc.init(socketName, serverHandlers as any)
} else {
  isDev = true


  ipcRenderer.on('set-socket', (event, { name }) => {
    ipc.init(name, serverHandlers as any)
  })
}


console.log(isDev)