const Promise = require('bluebird')
const pify = require('pify')
const stubTrue = require('lodash/stubTrue')
const promisify = input => pify(input, Promise)
const unprefixHex = hex => hex.startsWith('0x') ? hex.slice(2) : hex
const prefixHex = hex => hex.startsWith('0x') ? hex : '0x' + hex
const hexToBuf = hex => Buffer.isBuffer(hex) ? hex : new Buffer(unprefixHex(hex), 'hex')
const hexsToBufs = hexes => hexes.map(hexToBuf)
const bufToHex = buf => typeof buf === 'string' ? buf : buf.toString('hex')
const bufsToHexs = bufs => bufs.map(bufToHex)
const HEX_REGEX = /^[0-9A-F]+$/i
const isHex = str => HEX_REGEX.test(str)
const assertHex = str => {
  if (!isHex(str)) {
    throw new Error('expected hex string')
  }
}

const prettify = obj => obj ? JSON.stringify(obj, null, 2) : obj
const isAddressHash = hash => unprefixHex(hash).length === 40
const isTxHash = hash => unprefixHex(hash).length === 64
const assertOptionType = (obj, opt, optType) => {
  if (typeof obj[opt] !== optType) {
    throw new Error(`expected ${optType} "${opt}"`)
  }
}

const pluck = (arr, prop) => arr.map(obj => obj[prop])

const retry = async (fn, {
  initialDelay=1000,
  maxAttempts=10,
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

  throw new Error('timed out')
}

const jitterize = (val, jitter) => {
  if (jitter <= 0 || jitter >= 1) {
    throw new Error('expected 0 < jitter < 1')
  }

  const max = 1 + jitter
  const min = 1 - jitter
  const factor = min + Math.random() * (max - min)
  return Math.floor(val * factor)
}

module.exports = {
  promisify,
  unprefixHex,
  prefixHex,
  bufToHex,
  bufsToHexs,
  hexToBuf,
  hexsToBufs,
  isHex,
  assertHex,
  prettify,
  isAddressHash,
  isTxHash,
  assertOptionType,
  pluck,
  retry,
}
