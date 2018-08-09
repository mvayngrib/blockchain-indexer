const { usingLevelDBFromPath } = require('../db')
const createState = require('../state').create
const { createAddressIndexer } = require('../index-addresses')
const createBlockProcessor = require('../block-processor').create
const createLogger = require('../logger').create
const { prettify } = require('../utils')
const getWeb3 = require('./web3')

module.exports = opts => {
  const { testing, dbPath } = opts
  const web3 = getWeb3(opts)
  const state = createState(usingLevelDBFromPath(dbPath))
  const processor = createBlockProcessor({ web3, state })
  const logger = createLogger('progress')
  const confirmationHeight = testing ? 0 : 15

  const indexer = createAddressIndexer({ state, processor, confirmationHeight })
  indexer.on('**', function (data) {
    logger.info(this.event, prettify(data))
  })

  indexer.start()

  const keepAlive = () => {
    const interval = setInterval(() => {
      // keep alive
    }, 1000)

    return () => clearInterval(interval)
  }

  keepAlive()
}
