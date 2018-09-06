const createState = require('./state').create
const { createAddressIndexer } = require('./indexer/addr-txs')
const createBlockProcessor = require('./blocks').create
const { joinPaths } = require('./utils')
const createServer = require('./server').serve
const createEthApi = require('./eth').fromWeb3
const createApi = require('./api').create
const createLogger = require('./logger').create
const Conf = require('./conf')
const VERSION = 'v1'
const DEFAULT_COMPONENTS = {
  server: true,
  indexer: true,
}

const RPC_METHODS = [
  'eth_blockNumber',
  'eth_getTransactionCount',
  'eth_sendRawTransaction',
  'eth_getBalance',
  'eth_syncing',
]

const loadComponents = (conf, componentsNeeded=DEFAULT_COMPONENTS) => {
  const {
    node,
    dbPath,
    network,
    port,
    startBlock,
    blocksPerBatch,
    confirmationHeight,
    serverBasePath='/',
  } = Conf.fromJson(conf)

  const logger = createLogger('main')
  const runIndexer = componentsNeeded.indexer || componentsNeeded.processor
  const web3 = loadWeb3(conf)
  const ethApi = createEthApi({ web3, concurrency: conf.web3Concurrency })
  let storage
  if (conf.storage === 'redis') {
    logger.debug('storage: redis')
    storage = require('./storage/redis').create({
      port: conf.redis.port,
      hostname: 'localhost',
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
    let prefix = joinPaths(serverBasePath, VERSION)
    if (conf.prefixPathWithNetworkName) {
      prefix = `${prefix}/${network}`
    }

    logger.log(`router prefix: ${prefix}`)
    ret.server = createServer({
      port,
      prefix,
      api: ret.api,
      rpcHost: `${node.hostname}:${node.httpPort}`,
      rpcMethods: RPC_METHODS,
      logger: createLogger('server'),
    })
  }

  if (runIndexer) {
    const processor = createBlockProcessor({ ethApi, state, network })
    ret.processor = processor
    ret.indexer = createAddressIndexer({
      state,
      processor,
      blocksPerBatch,
      confirmationHeight,
      logger: createLogger('indexer'),
    })

    ret.indexer.start().catch(err => {
      logger.error('indexer crashed, forcing exit', err.stack)
      process.exit(1)
    })
  }

  logger.log(`loaded components: ${Object.keys(ret).join(', ')}`)

  return ret
}

const loadWeb3 = conf => {
  const { network, node, dbPath, blockTime } = conf
  const logger = createLogger('web3')
  if (network === 'private') {
    return require('./test/web3').create({
      hostname: node.hostname,
      port: node.wsPort,
      useWS: node.useWS,
      dbPath,
      blockTime,
      logger,
    })
  }

  return require('./web3').create({
    ...node,
    logger,
  })
}

module.exports = loadComponents
