/* eslint-disable */
const createBIndexer = require('./')
const components = createBIndexer({
  network: 'mainnet',
  dir: './',
  nodeHTTPPort: 8545,
  nodeWSPort: 8546,
  // port to run HTTP server on
  port: 9898,
  blocksPerBatch: 100,
  startBlock: 203700,
  confirmationHeight: 15,
  storage: 'leveldb'
  // alternatively with redis:
  // storage: 'redis',
  // redis: {
  //   port: 6379
  // }
})

// in case you need to use the individual components:
const {
  server,
  api,
  indexer,
  processor,
  state,
  storage,
} = components
