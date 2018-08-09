#!/usr/bin/env node

const yargs = require('yargs')
const logger = require('../logger').fromConsole()
const conf = require('../conf').load(process.cwd())
const withConf = fn => opts => fn(conf, opts)

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
    handler: argv => require('./get')
      .get(conf, argv)
      .then(logger.logPretty, logger.error),
  })
  .command({
    command: 'dump',
    desc: `print address->txs db state`,
    handler: withConf(async ({ dbPath }) => {
      const { usingLevelDBFromPath } = require('../db')
      const createState = require('../state').create
      const state = createState(usingLevelDBFromPath(dbPath))
      state.createReadStream().on('data', logger.logPretty)
    })
  })
  .argv
