const Promise = require('bluebird')
const pify = require('pify')
const stubTrue = require('lodash/stubTrue')
const pickBy = require('lodash/pickBy')
const promisify = input => pify(input, Promise)
const Errors = require('./errors')
const unprefixHex = hex => hex.startsWith('0x') ? hex.slice(2) : hex
const prefixHex = hex => hex.startsWith('0x') ? hex : '0x' + hex
const hexToBuf = hex => Buffer.isBuffer(hex) ? hex : new Buffer(unprefixHex(hex), 'hex')
const bufToHex = buf => typeof buf === 'string' ? buf : buf.toString('hex')
const HEX_REGEX = /^[0-9A-F]+$/i
const isHex = str => str.length % 2 === 0 && HEX_REGEX.test(str)
const assertHex = str => {
  if (!isHex(str)) {
    throw new Errors.InvalidInput('expected hex string')
  }
}

const prettify = obj => obj ? JSON.stringify(obj, null, 2) : obj
const isAddressHash = hash => unprefixHex(hash).length === 40
const isTxHash = hash => unprefixHex(hash).length === 64
const assertOptionType = (obj, opt, optType) => {
  const actual = typeof obj[opt]
  if (actual !== optType) {
    throw new Errors.InvalidInput(`expected ${optType} "${opt}", got "${actual}"`)
  }
}

const pluck = (arr, prop) => arr.map(obj => obj[prop])
const pickNonNull = obj => pickBy(obj, val => val != null)

const retry = async (fn, {
  initialDelay=1000,
  maxAttempts=Infinity,
  maxTime=Infinity,
  factor=2,
  jitter=0.1,
  shouldRetry=stubTrue,
  maxDelay,
  logger
}) => {
  if (typeof maxDelay !== 'number') maxDelay = maxTime / 2

  const start = Date.now()
  let millisToWait = initialDelay
  let attempts = 0
  while (Date.now() - start < maxTime && attempts++ < maxAttempts) {
    try {
      return await fn()
    } catch (err) {
      if (!shouldRetry(err)) {
        throw err
      }

      let jitterizedDelay = millisToWait
      if (jitter) {
        jitterizedDelay = jitterize(jitterizedDelay, jitter)
      }

      if (logger) {
        logger.debug(`backing off ${jitterizedDelay}ms`)
      }

      await Promise.delay(jitterizedDelay)
      millisToWait = Math.min(
        maxDelay,
        millisToWait * factor,
        maxTime - (Date.now() - start)
      )

      if (millisToWait < 0) {
        if (logger) logger.debug('giving up')
        break
      }
    }
  }

  throw new Errors.Timeout('timed out')
}

const jitterize = (val, jitter) => {
  if (jitter <= 0 || jitter >= 1) {
    throw new Errors.InvalidInput('expected 0 < jitter < 1')
  }

  const max = 1 + jitter
  const min = 1 - jitter
  const factor = min + Math.random() * (max - min)
  return Math.floor(val * factor)
}

const intToHex = (n, padToByteLength) => {
  if (typeof n !== 'number') {
    throw new Errors.InvalidInput('expected number and byte length')
  }

  const hex = n.toString(16)
  const padLength = typeof padToByteLength === 'number'
    ? padToByteLength * 2 - hex.length
    : 0

  if (padLength > 0) {
    return '0'.repeat(padLength) + hex
  }

  return hex
}

const bufToInt = buf => parseInt(buf.toString('hex'), 16)
const intToBuf = n => {
  let hex = n.toString(16)
  if (hex.length % 2) {
    hex = '0' + hex
  }

  return new Buffer(hex, 'hex')
}

const blockNumberToHex = blockNumber => intToHex(blockNumber, 4)
const trimSlashes = str => str
  .replace(/^[/]+/, '')
  .replace(/[/]+$/, '')

const joinPaths = (...paths) => '/' + paths
  .map(trimSlashes)
  .filter(p => p.length)
  .join('/')


module.exports = {
  promisify,
  unprefixHex,
  prefixHex,
  bufToHex,
  hexToBuf,
  isHex,
  assertHex,
  prettify,
  isAddressHash,
  isTxHash,
  assertOptionType,
  pluck,
  retry,
  intToBuf,
  bufToInt,
  blockNumberToHex,
  pickNonNull,
  trimSlashes,
  joinPaths,
}
