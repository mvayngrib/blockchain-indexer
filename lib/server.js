
const Koa = require('koa')
const Router = require('koa-router')
const yn = require('yn')
const Promise = require('bluebird')
const extend = require('lodash/extend')
const { prettify } = require('./utils')
const createLogger = require('./logger').create
const Errors = require('./errors')
const routes = {
  txs: '/txs',
  // address: '/address/:address',
  addresses: '/addresses',
  blockNumber: '/blockNumber',
  processedBlockNumber: '/processedBlockNumber',
  balance: '/balance/:address',
  sendSignedTransaction: '/sendSignedTransaction',
}

const MAX_BATCH_SIZE = 100
const parseBatchOpt = (obj, opt) => {
  const val = obj[opt]
  if (typeof val !== 'string' && !Array.isArray(val)) {
    throw new Errors.InvalidInput(`expected comma-separated list for option "${opt}"`)
  }

  // coerce to array
  const batch = [].concat(val)
  if (batch.length > MAX_BATCH_SIZE) {
    throw new Errors.InvalidInput(`max batch size is: ${MAX_BATCH_SIZE}`)
  }

  return batch
}

const timeoutOpts = {
  timeout: 10000
}

const getErrorResponse = err => {
  if (Errors.isNotFound(err)) {
    return {
      status: 404,
      body: {
        type: err.type,
        message: err.message,
      }
    }
  }

  if (Errors.matches(err, Errors.InvalidInput)) {
    return {
      status: 400,
      body: {
        type: err.type,
        message: err.message,
      }
    }
  }

  return {
    status: 500,
    body: {
      type: err.type || 'ServerError',
      message: err.message,
    }
  }
}

const returnAsProp = (fn, prop) => (...args) => fn(...args).then(result => ({ [prop]: result }))
const wrapWithTimeoutOpts = fn => (...args) => fn(...args, timeoutOpts)
const mergeAddrTxs = addrs => addrs.reduce((txs, addr) => txs.concat(addr.txs), [])

const serve = ({ port, api }) => {
  const app = new Koa()
  const router = new Router()
  const logger = createLogger('server')
  const wrap = fn => async (ctx, next) => {
    try {
      ctx.body = await fn(ctx)
    } catch (err) {
      extend(ctx, getErrorResponse(err))
    }

    await next()
  }

  const getBlockNumber = wrapWithTimeoutOpts(returnAsProp(api.getBlockNumber, 'blockNumber'))
  const getProcessedBlockNumber = wrapWithTimeoutOpts(returnAsProp(api.getProcessedBlockNumber, 'blockNumber'))
  const sendSignedTransaction = wrapWithTimeoutOpts(returnAsProp(api.sendSignedTransaction, 'hash'))
  const getBalance = wrapWithTimeoutOpts(returnAsProp(api.getBalance, 'balance'))
  const getTransactions = wrapWithTimeoutOpts(api.getTransactions)

  router.get(routes.txs, wrap(async ctx => {
    return await Promise.props({
      txs: getTransactions({
        hashes: parseBatchOpt(ctx.query, 'hashes')
      }),
      blockNumber: api.getProcessedBlockNumber(),
    })
  }))

  // router.get(routes.address, wrap(ctx => api.getAddress(ctx.params.address)))
  router.get(routes.addresses, wrap(async ctx => {
    const addresses = parseBatchOpt(ctx.query, 'addresses')
    const lookupTxs = yn(ctx.query.lookupTxs)
    const blockNumber = Number(ctx.query.blockNumber || 0)
    const limit = Number(ctx.query.limit || Infinity)
    return await Promise.props({
      txs: api.getAddresses({ addresses, blockNumber, lookupTxs, limit }, timeoutOpts).then(mergeAddrTxs),
      blockNumber: api.getProcessedBlockNumber(),
    })
  }))

  router.get(routes.balance, wrap(ctx => getBalance({ address: ctx.params.address })))
  router.get(routes.blockNumber, wrap(getBlockNumber))
  router.get(routes.processedBlockNumber, wrap(getProcessedBlockNumber))
  router.post(routes.sendSignedTransaction, wrap(ctx => sendSignedTransaction(ctx.body.tx)))

  // Object.keys(api.web3).forEach(method => {
  //   router.get(routes.web3, wrap(ctx => api.web3[method](ctx.params)))
  // })

  app
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(port)

  logger.log('serving on port 9898')
  logger.log(`routes: ${prettify(routes)}`)
}

module.exports = {
  serve,
}
