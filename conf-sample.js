module.exports = {
  // COMMON

  // see lib/networks.js
  network: 'private',
  dir: './',
  blocksPerBatch: 100,
  startBlock: 200000,
  // height at which a block is considered confirmed
  confirmationHeight: 15,
  // exported API port
  port: 3000,
  storage: 'leveldb',
  // or redi:
  // storage: 'redis',
  // redis: {
  //   port: 6379
  // },

  // NOT COMMON

  // non-'private' network
  node: {
    hostname: 'localhost',
    httpPort: 8545,
    wsPort: 8546,
  },

  // 'private' network
  // blocks per second to mint
  blockTime: 2,
}
