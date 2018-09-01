
const Koa = require('koa')
const Router = require('koa-router')
const koaBody = require('koa-body')
const yn = require('yn')
const Promise = require('bluebird')
const extend = require('lodash/extend')
const { prettify } = require('./utils')
const createLogger = require('./logger').create
const Errors = require('./errors')
const routes = {
  health: '/health',
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
  let status = 500
  let { type, message } = err
  if (Errors.isNotFound(err)) {
    status = 404
  } else if (Errors.matches(err, [Errors.InvalidInput, Errors.InsufficientFunds])) {
    status = 400
  } else if (Errors.matches(err, Errors.Timeout)) {
    message = 'timed out'
  } else {
    message = 'something went wrong'
  }

  return {
    status,
    body: {
      type,
      message,
    }
  }
}

const returnAsProp = (fn, prop) => (...args) => fn(...args).then(result => ({ [prop]: result }))
const wrapWithTimeoutOpts = fn => (...args) => fn(...args, timeoutOpts)
const setResultOnCtx = fn => async ctx => {
  ctx.body = await fn(ctx)
}

const mergeAddrTxs = addrs => addrs.reduce((txs, addr) => txs.concat(addr.txs), [])
const createDefaultErrorHandler = () => async (ctx, next) => {
  try {
    await next()
    if (ctx.status === 404) {
      throw new Errors.NotFound('route not found')
    }
  } catch (err) {
    extend(ctx, getErrorResponse(err))
  }
}

const serve = ({ port, api, prefix='/' }) => {
  const logger = createLogger('server')
  const getBlockNumber = wrapWithTimeoutOpts(returnAsProp(api.getBlockNumber, 'blockNumber'))
  const getProcessedBlockNumber = wrapWithTimeoutOpts(returnAsProp(api.getProcessedBlockNumber, 'blockNumber'))
  const sendSignedTransaction = wrapWithTimeoutOpts(returnAsProp(api.sendSignedTransaction, 'hash'))
  const getBalance = wrapWithTimeoutOpts(returnAsProp(api.getBalance, 'balance'))
  const getTransactions = wrapWithTimeoutOpts(api.getTransactions)

  const app = new Koa()
  const router = new Router({ prefix })
  router.get(routes.txs, setResultOnCtx(async ctx => {
    return await Promise.props({
      txs: getTransactions({
        hashes: parseBatchOpt(ctx.query, 'hashes')
      }),
      blockNumber: api.getProcessedBlockNumber(),
    })
  }))

  // router.get(routes.address, ctx => api.getAddress(ctx.params.address))
  router.get(routes.addresses, setResultOnCtx(async ctx => {
    const addresses = parseBatchOpt(ctx.query, 'addresses')
    const lookupTxs = yn(ctx.query.lookupTxs)
    const blockNumber = Number(ctx.query.blockNumber || 0)
    const limit = Number(ctx.query.limit || Infinity)
    return await Promise.props({
      txs: api.getAddresses({ addresses, blockNumber, lookupTxs, limit }, timeoutOpts).then(mergeAddrTxs),
      blockNumber: api.getProcessedBlockNumber(),
    })
  }))

  router.get(routes.health, async ctx => {
    ctx.status = 200
  })

  router.get(routes.balance, setResultOnCtx(ctx => getBalance({ address: ctx.params.address })))
  router.get(routes.blockNumber, setResultOnCtx(getBlockNumber))
  router.get(routes.processedBlockNumber, setResultOnCtx(getProcessedBlockNumber))
  router.post(routes.sendSignedTransaction, koaBody())
  router.post(routes.sendSignedTransaction, setResultOnCtx(ctx => sendSignedTransaction(ctx.request.body.txHex)))

  app
    .use(createDefaultErrorHandler())
    .use(router.routes())
    .use(router.allowedMethods({
      throw: true,
    }))
    .listen(port)

  logger.log('serving on port 9898')
  logger.log(`routes: ${prettify(routes)}`)
}

module.exports = {
  serve,
}
