#!/usr/bin/env node

const path = require('path')
const yargs = require('yargs')
const logger = require('../logger').fromConsole()
const createComponents = require('../')
const { isAddressHash } = require('../utils')
const baseDir = path.resolve(process.cwd())
const conf = require('../conf').fromDir(baseDir)
const getByHash = async (hash) => {
  const { storage, api } = createComponents(conf, {
    api: true,
  })

  try {
    if (isAddressHash(hash)) {
      return await api.getAddress(hash)
    }

    return await api.getTransaction(hash)
  } finally {
    storage.close()
  }
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
      if (conf.storage === 'redis') {
        throw new Error('not supported for redis-based storage')
      }

      const { state } = createComponents(conf, { state: true })
      state.createReadStream().on('data', logger.logPretty)
    }
  })
  .argv

process.on('unhandledRejection', (...args) => {
  // eslint-disable-next-line no-console
  console.error('unhandled rejection', JSON.stringify(args, null, 2))
  // eslint-disable-next-line no-debugger
  debugger
})
