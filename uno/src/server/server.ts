//Código de entrada do servidor

let serverHandlers = require('./server-handlers')
let ipc = require('./server-ipc')
let { configurePeers } = require('./server-models')

let isDev, version

if (process.argv[2] === '--subprocess') {
  isDev = false
  version = process.argv[3]

  let socketName = process.argv[4]
  configurePeers(socketName, [])
  ipc.init(socketName, serverHandlers)
} else {
  let { ipcRenderer, remote } = require('electron')
  isDev = true
  version = remote.app.getVersion()

  ipcRenderer.on('set-socket', (event, { name }) => {
    configurePeers(name, [])
    ipc.init(name, serverHandlers)
  })
}


console.log(version, isDev)