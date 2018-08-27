
const Koa = require('koa')
const Router = require('koa-router')
const jsend = require('jsend')
const yn = require('yn')
const { prettify } = require('./utils')
const createLogger = require('./logger').create
const routes = {
  tx: '/tx/:hash',
  // address: '/address/:address',
  addresses: '/addresses',
  blockNumber: '/blockNumber',
  processedBlockNumber: '/processedBlockNumber',
  balance: '/balance/:address',
  sendSignedTx: '/sendSignedTx',
}

const serve = ({ port, api }) => {
  const app = new Koa()
  const router = new Router()
  const logger = createLogger('server')
  const wrap = fn => async (ctx, next) => {
    try {
      ctx.body = jsend.success(await fn(ctx))
    } catch (err) {
      ctx.status = 400
      ctx.body = jsend.fail(err.message)
    }

    await next()
  }

  router.get(routes.tx, wrap(ctx => api.getTransaction(ctx.params.hash)))
  // router.get(routes.address, wrap(ctx => api.getAddress(ctx.params.address)))
  router.get(routes.addresses, wrap(ctx => api.getAddresses({
    addresses: ctx.query.addresses.split(',').map(s => s.trim()),
    lookupTxs: yn(ctx.query.lookupTxs),
  })))

  router.get(routes.balance, wrap(ctx => api.getBalance(ctx.params.address)))
  router.get(routes.blockNumber, wrap(() => api.getBlockNumber()))
  router.get(routes.processedBlockNumber, wrap(() => api.getProcessedBlockNumber()))
  router.post(routes.sendSignedTx, wrap(ctx => api.sendSignedTransaction(ctx.body.tx)))

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
