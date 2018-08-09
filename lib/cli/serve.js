const createEmitter = require('../emitter').create
const { usingLevelDBFromPath } = require('../db')
const createState = require('../state').create
const { createAddressIndexer } = require('../index-addresses')
const createBlockProcessor = require('../blocks').create
const createLogger = require('../logger').create
const { prettify } = require('../utils')
const getWeb3 = require('./web3')

const serve = (conf, opts) => {
  const ee = createEmitter()
  const { network, dbPath } = conf
  const { logger } = opts
  const web3 = getWeb3(conf)
  const state = createState(usingLevelDBFromPath(dbPath))
  const processor = createBlockProcessor({ web3, state })
  const confirmationHeight = network === 'private' ? 0 : 15

  const indexer = createAddressIndexer({ state, processor, confirmationHeight })
  indexer.on('**', function (data) {
    const { event } = this
    if (event === 'error') {
      ee.emit(event, data)
    } else {
      logger.info(event, prettify(data))
    }
  })

  indexer.start()

  const keepAlive = () => {
    const interval = setInterval(() => {
      // keep alive
    }, 1000)

    return () => clearInterval(interval)
  }

  keepAlive()
  return ee
}

module.exports = {
  serve,
}
