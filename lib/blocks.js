const Promise = require('bluebird')
// const PromiseQueue = require('p-queue')
const createHooks = require('event-hooks')
const Errors = require('@tradle/errors')
const { EventEmitter } = require('./emitter')
const {
  prefixHex,
} = require('./utils')

const createLogger = require('./logger').create
const DEFAULT_GET_NEXT_BLOCK_OPTS = {
  confirmationHeight: 0
}

const POLLING_INTERVAL = 6000

const isNotConnected = err => {
  const message = err.message.toLowerCase()
  if (message.startsWith('invalid json rpc response') || message.startsWith('connection not open')) {
    return true
  }
}

const waitForEvent = (emitter, event, condition) => new Promise(resolve => {
  const listener = data => {
    if (condition(event, data)) {
      emitter.off(event, listener)
      resolve()
    }
  }

  emitter.on(event, listener)
})

class Blocks extends EventEmitter {
  constructor({ web3, state }) {
    super({
      wildcard: true,
      delimiter: ':',
    })

    // this.setMaxListeners(0)
    this.web3 = web3
    this.state = state
    this.logger = createLogger('s')
    this.hooks = createHooks()
    this.hook = this.hooks.hook
    this.empty = Promise.resolve()
    this.waiters = {}
    this.ready = this._init()
    this._lastSynced = 0
    this._stopped = false
    // this.queue = new PromiseQueue({ concurrency: 1 })
  }

  async _init () {
    await Promise.all([
      this._loadLatestBlockNumber(),
      this._loadSavedBlockNumber(),
    ])

    this.logger.debug(`monitoring blockchain...
  tip: ${this.latestBlockNumber}
  processed height: ${this.savedBlockNumber}`)

    this.subscription = this.web3.subscribe('newBlockHeaders')
    this.subscription.on('data', this._onBlockHeader.bind(this))
    this.subscription.on('error', err => this.fire('error', err))
    // in case events stop coming in
    this._pollForBlocks()
  }

  async _pollForBlocks() {
    while (!this._stopped) {
      if (Date.now() - this._lastSynced > POLLING_INTERVAL) {
        await this._loadLatestBlockNumber()
      }

      await Promise.delay(POLLING_INTERVAL)
    }
  }

  async _loadLatestBlockNumber() {
    let n
    while (true) {
      try {
        n = await this.web3.getBlockNumber()
        break
      } catch (err) {
        if (isNotConnected(err)) {
          console.warn(`are you sure your ethereum node is running? I'll try again in a bit...`)
          await Promise.delay(5000)
          continue
        }

        throw err
      }
    }

    this._lastSynced = Date.now()
    if (typeof this.latestBlockNumber === 'undefined' || n > this.latestBlockNumber) {
      this._setLatestBlockNumber(n)
    }
  }

  _setLatestBlockNumber(n) {
    this.latestBlockNumber = n
    this.logger.debug(`latest block: ${n}`)
  }

  async _loadSavedBlockNumber() {
    this.savedBlockNumber = await this.state.getBlockNumber()
  }

  async _waitForBlock(number) {
    await this.ready
    this.logger.debug(`waiting for block ${number}`)
    await waitForEvent(this, 'block:number', (event, n) => n >= number)
  }

  _onBlockHeader({ number }) {
    this._setLatestBlockNumber(number)
    this.emit(`block:number`, number)
  }

  async getNextBlock({ confirmationHeight }=DEFAULT_GET_NEXT_BLOCK_OPTS) {
    await this.ready
    await this._loadSavedBlockNumber()
    const nextNumber = this.savedBlockNumber + 1
    const bufferedHeight = this.latestBlockNumber - nextNumber
    if (bufferedHeight < confirmationHeight) {
      await this._waitForBlock(nextNumber + confirmationHeight)
    }

    while (true) {
      try {
        return await this.getBlock(nextNumber)
      } catch (err) {
        Errors.rethrow(err, 'system')
        this.logger.debug('block not available yet')
        await Promise.delay(1000)
      }
    }
  }

  async getBlock(number) {
    const block = await this.web3.getBlock(number, true)
    if (!block) {
      throw new Error(`block not found with number ${number}`)
    }

    return block
  }

  async getTx(hash) {
    return await this.web3.getTransaction(prefixHex(hash))
  }

  async stop() {
    this._stopped = true
    await this.ready
    await this.subscription.unsubscribe()
  }
}

const createBlocks = opts => new Blocks(opts)

module.exports = {
  create: createBlocks,
}
