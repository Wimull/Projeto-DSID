// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { ipcRenderer, contextBridge } from 'electron'
// import isDev from 'electron-is-dev'
import ipc from 'node-ipc'
// eslint-disable-next-line import/no-unresolved
import * as uuid from 'uuid'
import serverHandlers from './server/server-handlers'
import serverIpc from './server/server-ipc'

let resolveSocketPromise: (value: string | PromiseLike<string>) => void
const socketPromise = new Promise((resolve) => {
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

contextBridge.exposeInMainWorld(
    'ipcConnect',
    (id: string, func: (client: any, on: (cbs: any[]) => void) => void) => {
        ipc.config.silent = true
        ipc.connectTo(id, () => {
            func(ipc.of[id], (cbs) => {
                cbs.forEach((...args: any[]) => {
                    //@ts-ignore
                    ipc.of[id].on(...args)
                })
            })
        })
    }
)

contextBridge.exposeInMainWorld('uuid', uuid)
