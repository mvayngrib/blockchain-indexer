const createLogger = require('./logger').create

module.exports = ({ network, port, dbPath, blockTime }) => {
  const logger = createLogger('web3')
  if (network === 'private') {
    return require('../test/web3').create({
      port,
      dbPath,
      blockTime,
      logger,
    })
  }

  return require('../web3').create({
    port,
    logger,
  })
}
