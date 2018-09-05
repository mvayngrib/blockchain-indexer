// source: https://github.com/MaiaVictor/eth-lib/blob/master/src/transaction.js

const BN = require('bn.js')
const Promise = require('bluebird')
const pick = require('lodash/pick')
const { unprefixHex } = require('./utils')
const fromBN = bn => '0x' + bn.toString('hex')
const toBN = str => {
  if (typeof str === 'number') {
    str = str.toString(16)
  }

  return new BN(unprefixHex(str), 16)
}

const bin = method => (a, b) => fromBN(toBN(a)[method](toBN(b)))
const mul = bin('mul')
const div = bin('div')
// const add = bin('add')
// const sub = bin('sub')

const getSendTransactionDefaults = async (web3, props) => {
  const { eth } = web3
  const { from, to, chainId, gasPrice, nonce, value, data, gas } = props
  const defaults = await Promise.props({
    from,
    to,
    chainId: chainId || eth.net.getId(),
    gasPrice: gasPrice || eth.getGasPrice(),
    nonce: nonce || eth.getTransactionCount(from, 'latest'),
    value: value || '0x0',
    data: data || '0x'
  })

  if (!gas) {
    const tx = pick(defaults, ['from', 'to', 'value', 'nonce', 'data'])
    const estimate = await eth.estimateGas(tx)
    defaults.gas = div(mul(estimate, '0x6'), '0x5')
  }

  return defaults
}

module.exports = {
  getSendTransactionDefaults,
}
