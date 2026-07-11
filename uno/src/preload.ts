// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { ipcRenderer, contextBridge } from 'electron'
// import isDev from 'electron-is-dev'
import ipc from 'node-ipc'
import * as uuid from 'uuid'
import serverHandlers from './server/server-handlers'
import serverIpc from './server/server-ipc'

let resolveSocketPromise
let socketPromise = new Promise((resolve) => {
    resolveSocketPromise = resolve
})

// window.IS_DEV = isDev

contextBridge.exposeInMainWorld('getServerSocket', () => {
    return socketPromise
})

ipcRenderer.on('set-socket', (event, { name }) => {
    resolveSocketPromise(name)
})

ipcRenderer.on('set-socket', (event, { name }) => {
    serverIpc.init(name, serverHandlers as any)
})

contextBridge.exposeInMainWorld('ipcConnect', (id, func) => {
    ipc.config.silent = true
    ipc.connectTo(id, () => {
        func(ipc.of[id], (cbs) => {
            cbs.forEach((args) => {
                ipc.of[id].on(...args)
            })
        })
    })
})

contextBridge.exposeInMainWorld('uuid', uuid)
