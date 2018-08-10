module.exports = {
  // see lib/networks.js
  network: 'private',
  dir: './',
  blocksPerBatch: 100,
  startBlock: 200000,
  // height at which a block is considered confirmed
  confirmationHeight: 15,
  // for networks other than 'private'
  port: 8546,
  // blocks per second to mint
  // 'private' network only
  blockTime: 2,
}
