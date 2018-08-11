
const Koa = require('koa')
const Router = require('koa-router')
const { prettify } = require('./utils')
const createLogger = require('./logger').create

const routes = {
  tx: '/tx/:hash',
  address: '/address/:hash'
}

const serve = ({ port, api }) => {
  const app = new Koa()
  const router = new Router()
  const logger = createLogger('server')
  const wrap = fn => async (ctx, next) => {
    try {
      ctx.body = await fn(ctx)
    } catch (err) {
      ctx.status = 400
      ctx.body = {
        message: err.message
      }
    }

    await next()
  }

  router.get(routes.tx, wrap(ctx => api.getTx(ctx.params.hash)))
  router.get(routes.address, wrap(ctx => api.getAddress(ctx.params.hash)))

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
