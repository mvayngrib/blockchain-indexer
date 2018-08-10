
const Koa = require('koa')
const Router = require('koa-router')
const { prettify } = require('./utils')
const createLogger = require('./logger').create

const routes = {
  tx: '/tx/:hash',
  address: '/address/:hash'
}

const serve = ({ port, ethApi, state }) => {
  const app = new Koa()
  const router = new Router()
  const logger = createLogger('server')
  router.get(routes.tx, async (ctx, next) => {
    try {
      ctx.body = await ethApi.getTx(ctx.params.hash)
    } catch (err) {
      ctx.status = 400
      ctx.body = {
        message: err.message
      }
    }

    await next()
  })

  router.get(routes.address, async (ctx, next) => {
    try {
      ctx.body = await state.getAddress(ctx.params.hash)
    } catch (err) {
      ctx.status = 400
      ctx.body = {
        message: err.message
      }
    }

    await next()
  })

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
