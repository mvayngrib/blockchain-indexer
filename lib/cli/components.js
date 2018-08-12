const createState = require('../state').create
const { createAddressIndexer } = require('../index-addresses')
const createBlockProcessor = require('../blocks').create
// const { prettify } = require('../utils')
const getWeb3 = require('./web3')
const createServer = require('../server').serve
const createEthApi = require('../eth').fromWeb3
const createApi = require('../api').create
const createLogger = require('../logger').create

const fromConf = (conf, components) => {
  const {
    dbPath,
    network,
    port,
    startBlock,
    blocksPerBatch,
    confirmationHeight,
  } = conf

  const logger = createLogger('components')
  const runIndexer = components.indexer || components.processor
  const live = runIndexer
  const web3 = getWeb3({ ...conf, live })
  const ethApi = createEthApi(web3)
  let storage
  if (conf.storage === 'redis') {
    logger.debug('storage: redis')
    storage = require('../storage/redis').create({
      port: conf.redis.port,
      host: 'localhost',
      network,
    })
  } else {
    logger.debug('storage: leveldb')
    storage = require('../storage/leveldb').fromPath(dbPath)
  }

  const state = createState({ storage, startBlock })
  const ret = {
    storage,
    state,
    ethApi,
  }

  if (components.api || components.server) {
    ret.api = createApi({ ethApi, state })
  }

  if (components.server) {
    ret.server = createServer({ port, api: ret.api })
  }

  if (runIndexer) {
    const processor = createBlockProcessor({ web3, state, network })
    ret.processor = processor
    ret.indexer = createAddressIndexer({
      state,
      processor,
      blocksPerBatch,
      confirmationHeight
    })
  }

  return ret
}

module.exports = {
  fromConf,
}
