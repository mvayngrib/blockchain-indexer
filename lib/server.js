
const Koa = require('koa')
const Router = require('koa-router')
const koaBody = require('koa-body')
const yn = require('yn')
const Promise = require('bluebird')
const extend = require('lodash/extend')
const pick = require('lodash/pick')
const createHttpProxy = require('koa-better-http-proxy')
const { prettify } = require('./utils')
const Errors = require('./errors')
const routes = {
  health: '/health',
  txs: '/txs',
  addresses: '/addresses',
  blockNumber: '/blockNumber',
  txDefaults: '/txDefaults',
}

const MAX_BATCH_SIZE = 100
const parseBatchOpt = (obj, opt) => {
  const val = obj[opt]
  if (typeof val !== 'string' && !Array.isArray(val)) {
    throw new Errors.InvalidInput(`expected comma-separated list for option "${opt}", got ${val}`)
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
  } else if (Errors.matches(err, [Errors.InvalidInput, Errors.InsufficientFunds, Errors.Duplicate])) {
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

const wrapWithTimeoutOpts = fn => (...args) => fn(...args, timeoutOpts)
const setResultOnCtx = fn => async ctx => {
  ctx.body = {
    result: await fn(ctx)
  }
}

const mergeAddrTxs = addrs => addrs.reduce((txs, addr) => txs.concat(addr.txs), [])
const createDefaultErrorHandler = logger => async (ctx, next) => {
  logger.log(`request path: ${ctx.request.path}`,)
  try {
    await next()
    if (!ctx.body && ctx.status === 404) {
      throw new Errors.NotFound('route not found')
    }
  } catch (err) {
    logger.error(pick(err, ['message', 'type', 'stack']))
    extend(ctx, getErrorResponse(err))
  }
}

const serve = ({ port, api, prefix='/', rpcHost, rpcMethods=[], logger }) => {
  const getProcessedBlockNumber = wrapWithTimeoutOpts(api.getProcessedBlockNumber)
  const getTransactions = wrapWithTimeoutOpts(api.getTransactions)
  const getSendTransactionDefaults = wrapWithTimeoutOpts(api.getSendTransactionDefaults)

  const app = new Koa()
  const router = new Router({ prefix })
  router.get(routes.health, async ctx => {
    ctx.status = 200
  })

  router.use(koaBody({
    onError: err => {
      throw new Errors.InvalidInput(err.message)
    }
  }))

  // router.get('/etherscan', async (ctx, next) => {
  //   const { module, action, ...args } = ctx.request.query

  // })

  router.post('/rpc', createHttpProxy(rpcHost, {
    filter: ctx => {
      // const { method, id } = ctx.request.body
      const { method } = ctx.request.body
      if (rpcMethods.includes(method)) {
        return true
      }

      ctx.status = 403
      ctx.body = {
        message: 'Forbidden'
      }

      // ctx.body = {
      //   id,
      //   jsonrpc: '2.0',
      //   error: {
      //     code: -32601,
      //     message: 'Method not found',
      //   },
      // }

      return false
    },
    proxyReqPathResolver: () => '/',
  }))

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

  router.get(routes.blockNumber, setResultOnCtx(getProcessedBlockNumber))
  router.post(routes.txDefaults, setResultOnCtx(async ctx => {
    return await getSendTransactionDefaults(ctx.request.body.tx)
  }))

  app
    .use(createDefaultErrorHandler(logger))
    .use(router.routes())
    .use(router.allowedMethods({
      throw: true,
    }))
    .listen(port)

  logger.log(`serving on port ${port}`)
  logger.log(`routes: ${prettify(routes)}`)
}

module.exports = {
  serve,
}
