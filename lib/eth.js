const Promise = require('bluebird')
const omit = require('lodash/omit')
const {
  prefixHex
} = require('./utils')

const { NotFound } = require('./errors')
const networks = require('./networks')
const getNetworkNameById = id => Object.keys(networks)
  .find(name => networks[name].network_id === id) || 'private'

// {
//   startingBlock: 100,
//   currentBlock: 312,
//   highestBlock: 512,
//   knownStates: 234566,
//   pulledStates: 123455
// }

const wrap = (fn, args) => {
  const wrapped = () => fn(...args)
  wrapped._originalName = fn.name
  return wrapped
}

const wrapWithCxnCheck = fn => (...args) => tryWeb3Call(wrap(fn, args))
const isNotConnected = err => {
  const message = err.message.toLowerCase()
  if (message.startsWith('invalid json rpc response') || message.startsWith('connection not open')) {
    return true
  }
}

const tryWeb3Call = async (fn) => {
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (isNotConnected(err)) {
        // eslint-disable-next-line no-console
        console.warn(`${fn._originalName}: are you sure your ethereum node is running? I'll try again in a bit...`)
        await Promise.delay(5000)
        continue
      }

      throw err
    }
  }
}

class EthApi {
  constructor(web3) {
    this.web3 = web3
    ;[
      'getAvailableBlockNumber',
      'getBlockNumber',
      'getBlock',
      'getBalance',
      'getTransaction',
      'ensureCorrectNetwork',
    ].forEach(method => {
      const orig = this[method].bind(this)
      this[method] = wrapWithCxnCheck(orig)
    })
  }

  async getAvailableBlockNumber() {
    const { web3 } = this
    let syncing
    while (!syncing) {
      syncing = await web3.isSyncing()
      if (syncing === false) {
        return this.getBlockNumber()
      }
    }

    return syncing.pulledStates || syncing.currentBlock
  }

  async getBlock(number) {
    const { web3 } = this
    const block = await web3.getBlock(number, true)
    if (!block) {
      throw new NotFound(`block with number ${number}`)
    }

    return block
  }

  getBlockNumber() {
    const { web3 } = this
    return web3.getBlockNumber()
  }

  getBalance(address, blockNumber) {
    const { web3 } = this
    return web3.getBalance(address, blockNumber)
  }

  async getTransaction(hash) {
    const { web3 } = this
    const tx = await web3.getTransaction(prefixHex(hash))
    if (!tx) {
      throw new NotFound(`tx with hash ${hash}`)
    }

    return tx
  }

  async ensureCorrectNetwork(network) {
    const { web3 } = this
    const id = networks[network].network_id
    const actual = await web3.net.getId()
    if (network === 'private') {
      const ok = Object.keys(omit(networks, 'private'))
        .every(({ network_id }) => actual !== network_id)

      if (!ok) {
        throw new Error(`expected private network, got network id: ${actual}`)
      }
    } else if (actual !== id) {
      const actualName = getNetworkNameById(actual)
      throw new Error(`expected network "${network}", actually on "${actualName}"`)
    }
  }
}

const fromWeb3 = web3 => new EthApi(web3)

module.exports = {
  fromWeb3,
}
