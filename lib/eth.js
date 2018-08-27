const Promise = require('bluebird')
const omit = require('lodash/omit')
const pLimit = require('p-limit')
const {
  prefixHex
} = require('./utils')

const { NotFound, ignoreNotConnected } = require('./errors')
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
  wrapped._originalName = fn.name.replace(/^bound\s/, '')
  return wrapped
}

const DEFAULT_WEB3_REQ_CONCURRENCY = 20

class EthApi {
  constructor({ web3, concurrency=DEFAULT_WEB3_REQ_CONCURRENCY }) {
    this.web3 = web3
    ;[
      'getAvailableBlockNumber',
      'getBlockNumber',
      'getBlock',
      'getBalance',
      'getTransaction',
      'ensureCorrectNetwork',
      'sendSignedTransaction',
    ].forEach(method => {
      const orig = this[method].bind(this)
      this[method] = (...args) => {
        return this._tryWeb3Call(wrap(orig, args))
      }
    })

    this._execWithLimitedConcurrency = pLimit(concurrency)
  }

  async getAvailableBlockNumber() {
    const { web3 } = this
    let syncing
    while (!syncing) {
      syncing = await web3.eth.isSyncing()
      if (syncing === false) {
        return this.getBlockNumber()
      }
    }

    return syncing.pulledStates || syncing.currentBlock
  }

  async getBlock(number) {
    const { web3 } = this
    const block = await web3.eth.getBlock(number, true)
    if (!block) {
      throw new NotFound(`block with number ${number}`)
    }

    return block
  }

  async getBlockNumber() {
    const { web3 } = this
    return web3.eth.getBlockNumber()
  }

  async getBalance(address, blockNumber) {
    const { web3 } = this
    const balance = web3.eth.getBalance(address, blockNumber)
    return web3.utils.toHex(balance)
  }

  async sendSignedTransaction(hex) {
    const { web3 } = this
    return web3.eth.sendSignedTransaction(hex)
  }

  async getTransaction(hash) {
    const { web3 } = this
    const tx = await web3.eth.getTransaction(prefixHex(hash))
    if (!tx) {
      throw new NotFound(`tx with hash ${hash}`)
    }

    return tx
  }

  async ensureCorrectNetwork(network) {
    const { web3 } = this
    const id = networks[network].network_id
    const actual = await web3.eth.net.getId()
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

  subscribeToNewBlockHeaders() {
    return this.web3.eth.subscribe('newBlockHeaders')
  }

  async _tryWeb3Call(fn) {
    while (true) {
      try {
        return await this._execWithLimitedConcurrency(fn)
      } catch (err) {
        ignoreNotConnected(err)
        // eslint-disable-next-line no-console
        console.warn(`${fn._originalName}: are you sure your ethereum node is running? I'll try again in a bit...`)
        await Promise.delay(5000)
      }
    }
  }

}

const fromWeb3 = web3 => new EthApi(web3)

module.exports = {
  fromWeb3,
}
