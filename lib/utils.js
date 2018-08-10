const Promise = require('bluebird')
const pify = require('pify')
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
}
