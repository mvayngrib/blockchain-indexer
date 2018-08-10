const createLogger = require('../logger').create

module.exports = conf => {
  const { network, nodeWSPort, dbPath, blockTime } = conf
  const logger = createLogger('web3')
  if (network === 'private') {
    return require('../test/web3').create({
      port: nodeWSPort,
      dbPath,
      blockTime,
      logger,
    })
  }

  return require('../web3').create({
    port: nodeWSPort,
    logger,
  })
}
