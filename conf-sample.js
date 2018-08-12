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
  port: 9898,
  storage: 'leveldb',
  // or redi:
  // storage: 'redis',
  // redis: {
  //   port: 6379
  // },

  // NOT COMMON

  // non-'private' network
  nodeHTTPPort: 8545,
  nodeWSPort: 8546,

  // 'private' network
  // blocks per second to mint
  blockTime: 2,
}
