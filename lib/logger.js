const each = require('lodash/each')
const { prettify } = require('./utils')
const prettifyArgs = args => args.length === 1 ? prettify(args[0]) : prettify(args)
const debug = require('debug')
const prefix = 'tradle:'

const createLogger = (namespace='') => {
  const wrapper = {
    log: debug(`${prefix}${namespace}`),
    debug: debug(`${prefix}debug:${namespace}`),
    info: debug(`${prefix}info:${namespace}`),
    warn: debug(`${prefix}warn:${namespace}`),
    error: debug(`${prefix}error:${namespace}`),
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

/* eslint-disable no-console */
const fromConsole = () => fromWrapper({
  log: console.log.bind(console),
  debug: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
})
/* eslint-enable */

module.exports = {
  create: createLogger,
  fromConsole,
}
