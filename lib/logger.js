const each = require('lodash/each')
const { prettify } = require('./utils')
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

  return fromWrapper(wrapper)
}

const fromWrapper = wrapper => {
  const api = {}
  each(wrapper, (fn, name) => {
    api[name] = (...args) => fn(...args)
    api[`${name}Pretty`] = (...args) => fn(prettifyArgs(args))
  })

  return api
}

const fromConsole = () => fromWrapper({
  log: console.log.bind(console),
  debug: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
})

module.exports = {
  create: createLogger,
  fromConsole,
}
