#!/usr/bin/env node

const yargs = require('yargs')
const logger = require('../logger').fromConsole()
const createComponents = require('./components').fromConf
const { isAddressHash } = require('../utils')
const conf = require('../conf').load(process.cwd())
const getByHash = async (hash) => {
  const { api } = createComponents(conf, {
    api: true,
  })

  if (isAddressHash(hash)) {
    return await api.getAddress(hash)
  }

  return await api.getTx(hash)
}

yargs
  .command({
    command: 'start',
    desc: 'start processing the blockchain',
    handler: argv => require('./serve')
      .serve(conf, {
        ...argv,
        logger,
      })
      .on('error', err => {
        logger.error(err.stack)
        process.exit(1)
      }),
  })
  .command({
    command: 'get <hash>',
    desc: 'get address or transaction by hash',
    handler: async ({ hash }) => {
      try {
        const result = await getByHash(hash)
        logger.logPretty(result)
      } catch (err) {
        logger.error(err.message)
        return
      }
    }
  })
  .command({
    command: 'dump',
    desc: 'print address->txs db state',
    handler: async () => {
      const { state } = createComponents(conf, { state: true })
      state.createReadStream().on('data', logger.logPretty)
    }
  })
  .argv
