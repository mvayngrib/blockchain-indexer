const createEmitter = require('../emitter').create
const { usingLevelDBFromPath } = require('../dbs')
const createState = require('../state').create
const { createAddressIndexer } = require('../index-addresses')
const createBlockProcessor = require('../blocks').create
// const { prettify } = require('../utils')
const getWeb3 = require('./web3')
const createServer = require('../server').serve
const createEthApi = require('../eth').fromWeb3
const createApi = require('../api').create

const fromConf = (conf, components) => {
  const {
    dbPath,
    network,
    port,
    startBlock,
    blocksPerBatch,
    confirmationHeight,
  } = conf

  const runIndexer = components.indexer || components.processor
  const live = runIndexer
  const web3 = getWeb3({ ...conf, live })
  const ethApi = createEthApi(web3)
  const dbs = usingLevelDBFromPath(dbPath)
  const state = createState({ ...dbs, startBlock })
  const ret = {
    ethApi,
    state,
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
