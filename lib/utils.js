const Promise = require('bluebird')
const pify = require('pify')
const promisify = input => pify(input, Promise)
const unprefixHex = hex => hex.startsWith('0x') ? hex.slice(2) : hex
const prefixHex = hex => hex.startsWith('0x') ? hex : '0x' + hex

module.exports = {
  promisify,
  unprefixHex,
  prefixHex,
}
