const each = require('lodash/each')
const prettify = obj => obj ? JSON.stringify(obj, null, 2) : ''
const prettifyArgs = args => args.length === 1 ? prettify(args[0]) : prettify(args)
const debug = require('debug')

const createLogger = (namespace='') => {
  const wrapper = {
    log: debug(`${namespace}`),
    debug: debug(`debug:${namespace}`),
    info: debug(`info:${namespace}`),
    warn: debug(`warn:${namespace}`),
    error: debug(`error:${namespace}`),
  }

  const api = {}
  each(wrapper, (fn, name) => {
    api[name] = (...args) => fn(...args)
    api[`${name}Pretty`] = (...args) => fn(prettifyArgs(args))
  })

  return api
}

module.exports = {
  create: createLogger,
}
