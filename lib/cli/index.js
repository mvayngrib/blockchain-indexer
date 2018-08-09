#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const yargs = require('yargs')
const withDefaults = require('lodash/defaults')
const serve = require('./serve')
const { prefixHex, isAddressHash } = require('../utils')
const { usingLevelDBFromPath } = require('../db')
const createState = require('../state').create
const logger = require('../logger').fromConsole()
const getWeb3 = require('./web3')
const testing = process.env.NODE_ENV === 'test'
const defaultOpts = {
  testing,
  dbPath: path.resolve(process.cwd(), 'ethernode.db'),
}

const withDefaultOpts = fn => opts => fn(withDefaults(opts, defaultOpts))
const createStateFromDBPath = dbPath => createState(usingLevelDBFromPath(dbPath))
const printAddress = async ({ dbPath, hash }) => {
  const state = createStateFromDBPath(dbPath)
  const info = await state.getAddress(hash)
  logger.logPretty(info)
}

const printTx = async ({ hash, ...opts }) => {
  const web3 = getWeb3(opts)
  try {
    const tx = await web3.getTransaction(prefixHex(hash))
    logger.logPretty(tx)
  } catch (err) {
    logger.error('tx not found')
  }
}

yargs
  // optional so that it can be passed via env var
  .command({
    command: 'start',
    desc: 'start processing the blockchain',
    handler: withDefaultOpts(serve),
  })
  .command({
    command: 'get <hash>',
    desc: 'get address or transaction by hash',
    handler: withDefaultOpts(argv => {
      if (isAddressHash(argv.hash)) {
        return printAddress(argv)
      }

      return printTx(argv)
    })
  })
  // .command({
  //   command: 'addr <hash>',
  //   desc: `get transactions for address`,
  //   handler: withDefaultOpts(printAddress),
  // })
  // .command({
  //   command: 'tx <hash>',
  //   desc: `get transaction`,
  //   handler: withDefaultOpts(printTx),
  // })
  .command({
    command: 'dump',
    desc: `print db state`,
    handler: withDefaultOpts(async ({ dbPath }) => {
      const state = createStateFromDBPath(dbPath)
      state.createReadStream().on('data', logger.logPretty)
    }),
  })
  .argv
