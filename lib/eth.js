const Promise = require('bluebird')
const omit = require('lodash/omit')
const pLimit = require('p-limit')
const { getSendTransactionDefaults } = require('./send-tx-defaults')

const {
  prefixHex
} = require('./utils')

const Errors = require('./errors')
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

const DEFAULT_EXEC_OPTS = {
  timeout: Infinity
}

const DEFAULT_WEB3_REQ_CONCURRENCY = 20

class EthApi {
  constructor({ web3, canSubscribe, concurrency=DEFAULT_WEB3_REQ_CONCURRENCY }) {
    const execWithLimitedConcurrency = pLimit(concurrency)
    this.web3 = web3
    this.canSubscribe = canSubscribe
    ;[
      'getAvailableBlockNumber',
      'getBlockNumber',
      'getBlock',
      // 'getBalance',
      'getTransaction',
      'ensureCorrectNetwork',
      // 'sendSignedTransaction',
      'getSendTransactionDefaults',
    ].forEach(method => {
      const orig = this[method].bind(this)
      this[method] = (opts, execOpts) => {
        const wrapped = wrap(orig, [opts])
        return execWithLimitedConcurrency(() => this._tryWeb3Call(wrapped, execOpts))
      }
    })
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
      throw new Errors.NotFound(`block with number ${number}`)
    }

    return block
  }

  async getBlockNumber() {
    const { web3 } = this
    return web3.eth.getBlockNumber()
  }

  // async getBalance({ address, blockNumber }) {
  //   const { web3 } = this
  //   const balance = await web3.eth.getBalance(prefixHex(address), blockNumber)
  //   return web3.utils.toHex(balance)
  // }

  // async getTransactionCount({ address }) {
  //   return await this.web3.eth.getTransactionCount(prefixHex(address))
  // }

  // async sendSignedTransaction(hex) {
  //   const { web3 } = this
  //   try {
  //     return await web3.eth.sendSignedTransaction(prefixHex(hex))
  //   } catch (err) {
  //     if (/insufficient funds/i.test(err.message)) {
  //       throw new Errors.InsufficientFunds(err.message)
  //     }

  //     if (/\bsame hash\b/i.test(err.message)) {
  //       throw new Errors.Duplicate(err.message)
  //     }

  //     throw err
  //   }
  // }

  async getTransaction(hash) {
    const { web3 } = this
    const tx = await web3.eth.getTransaction(prefixHex(hash))
    if (!tx) {
      throw new Errors.NotFound(`tx with hash ${hash}`)
    }

    return tx
  }

  async getSendTransactionDefaults(tx) {
    return getSendTransactionDefaults(this.web3, tx)
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
    if (!this.canSubscribe) {
      throw new Errors.InvalidInput('this client is not using a websocket provider')
    }

    return this.web3.eth.subscribe('newBlockHeaders')
  }

  async _tryWeb3Call(fn, opts=DEFAULT_EXEC_OPTS) {
    let timeLeft = opts.timeout
    while (true) {
      let iterationStart = Date.now()
      try {
        return await fn()
      } catch (err) {
        Errors.ignoreNotConnected(err)
        // eslint-disable-next-line no-console
        console.warn(`${fn._originalName}: are you sure your ethereum node is running? I'll try again in a bit...`)
        timeLeft -= (Date.now() - iterationStart)
        if (timeLeft < 0) break

        let delay = Math.min(timeLeft, 5000)
        timeLeft -= delay
        // no sense in just waiting if we won't try again
        if (timeLeft < 0) break

        await Promise.delay(delay)
      }
    }

    throw new Errors.Timeout(`${fn._originalName} timed out`)
  }

}

const fromWeb3 = web3 => new EthApi(web3)

module.exports = {
  fromWeb3,
}
