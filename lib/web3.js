
const Web3 = require('web3')
const RECONNECT_TIMEOUT = 10000

const configureProvider = (web3, opts) => {
  const { hostname='localhost', httpPort, wsPort, logger, useWS } = opts
  if (!useWS) {
    web3.setProvider(new Web3.providers.HttpProvider(`http://${hostname}:${httpPort}`))
    return
  }

  const wsOpts = {
    timeout: 30000,
    headers: {
      Origin: `http://${hostname}`
    }
  }

  const provider = new Web3.providers.WebsocketProvider(`ws://${hostname}:${wsPort}`, wsOpts)
  provider.on('end', err => {
    logger.error('websocket provider closed', err.message || '')
    logger.error(`attempting to reconnect in ${RECONNECT_TIMEOUT}ms`)
    cleanupDeadProvider(provider)
    setTimeout(() => configureProvider(web3, opts), RECONNECT_TIMEOUT)
  })

  provider.on('connect', () => {
    logger.log('WS provider connected')
  })

  web3.setProvider(provider)
}

// eslint-disable-next-line no-unused-vars
const cleanupDeadProvider = provider => {
  // TODO: implement me
  // clean up any broken websocket connections
}

const create = opts => {
  const web3 = new Web3()
  configureProvider(web3, opts)
  return web3
}

module.exports = {
  create,
}
