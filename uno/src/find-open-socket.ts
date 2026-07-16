import ipcModule from 'node-ipc'

const ipc: typeof ipcModule =
    ipcModule && typeof ipcModule === 'object' && 'default' in ipcModule
        ? (ipcModule.default as typeof ipcModule)
        : ipcModule

ipc.config.silent = true

function isSocketTaken(name: string, fn?: () => void) {
    return new Promise((resolve, reject) => {
        ipc.connectTo(name, () => {
            ipc.of[name].on('error', () => {
                ipc.disconnect(name)
                resolve(false)
            })

            ipc.of[name].on('connect', () => {
                ipc.disconnect(name)
                resolve(true)
            })
        })
    })
}

export default async function findOpenSocket() {
    let currentSocket = 1
    console.log('checking', currentSocket)
    while (await isSocketTaken('myapp' + currentSocket)) {
        currentSocket++
        console.log('checking', currentSocket)
    }
    console.log('found socket', currentSocket)
    return 'myapp' + currentSocket
}
