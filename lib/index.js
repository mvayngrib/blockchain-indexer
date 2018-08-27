const createState = require('./state').create
const { createAddressIndexer } = require('./indexer/addr-txs')
const createBlockProcessor = require('./blocks').create
// const { prettify } = require('./utils')
const createServer = require('./server').serve
const createEthApi = require('./eth').fromWeb3
const createApi = require('./api').create
const createLogger = require('./logger').create
const Conf = require('./conf')
const DEFAULT_COMPONENTS = {
  server: true,
  indexer: true,
}

const loadComponents = (conf, componentsNeeded=DEFAULT_COMPONENTS) => {
  const {
    dbPath,
    network,
    port,
    startBlock,
    blocksPerBatch,
    confirmationHeight,
  } = Conf.fromJson(conf)

  const logger = createLogger('main')
  const runIndexer = componentsNeeded.indexer || componentsNeeded.processor
  const live = runIndexer
  const web3 = loadWeb3({ ...conf, live })
  const ethApi = createEthApi({ web3, concurrency: conf.web3Concurrency })
  let storage
  if (conf.storage === 'redis') {
    logger.debug('storage: redis')
    storage = require('./storage/redis').create({
      port: conf.redis.port,
      host: 'localhost',
      network,
    })
  } else {
    logger.debug('storage: leveldb')
    storage = require('./storage/leveldb').fromPath(dbPath)
  }

  const state = createState({ storage, startBlock })
  const ret = {
    storage,
    state,
    ethApi,
  }

  if (componentsNeeded.api || componentsNeeded.server) {
    ret.api = createApi({ ethApi, state })
  }

  if (componentsNeeded.server) {
    const prefix = conf.prefixPathWithNetworkName ? `/${network}` : '/'
    ret.server = createServer({
      port,
      prefix,
      api: ret.api
    })
  }

  if (runIndexer) {
    const processor = createBlockProcessor({ ethApi, state, network })
    ret.processor = processor
    ret.indexer = createAddressIndexer({
      state,
      processor,
      blocksPerBatch,
      confirmationHeight
    })

    ret.indexer.start()
  }

  logger.log(`loaded components: ${Object.keys(ret).join(', ')}`)

  return ret
}

const loadWeb3 = conf => {
  const { network, node, live, dbPath, blockTime } = conf
  const logger = createLogger('web3')
  if (network === 'private') {
    return require('./test/web3').create({
      host: node.host,
      port: node.wsPort,
      dbPath,
      blockTime,
      logger,
    })
  }

  return require('./web3').create({
    ...node,
    live,
    logger,
  })
}

module.exports = loadComponents
