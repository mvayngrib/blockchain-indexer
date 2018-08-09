module.exports = ({ network, port, dbPath, blockTime }) => {
  if (network === 'private') {
    return require('../test/web3').create({
      port,
      dbPath,
      blockTime: blockTime || 2
    })
  }

  return require('../web3').create({ port })
}
