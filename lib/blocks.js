const Promise = require('bluebird')
const createHooks = require('event-hooks')
const memoize = require('lodash/memoize')
const Errors = require('@tradle/errors')
const { EventEmitter } = require('./emitter')
const createEthApi = require('./eth').fromWeb3
const {
  assertOptionType,
} = require('./utils')

const createLogger = require('./logger').create
const POLLING_INTERVAL = 6000
const DEFAULT_BUFFER = 1000

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
  constructor(opts) {
    super({
      wildcard: true,
      delimiter: ':',
    })

    assertOptionType(opts, 'web3', 'object')
    assertOptionType(opts, 'state', 'object')
    assertOptionType(opts, 'network', 'string')
    // assertOptionType(opts, 'blocksToBuffer', 'number')

    const { web3, state, network, blocksToBuffer=DEFAULT_BUFFER } = opts

    // this.setMaxListeners(0)
    this.web3 = web3
    this.eth = createEthApi(web3)
    this.state = state
    this.network = network
    this.blocksToBuffer = blocksToBuffer
    this.logger = createLogger('blocks')
    this.hooks = createHooks()
    this.hook = this.hooks.hook
    this.empty = Promise.resolve()
    this.waiters = {}
    this.blockPromiseCache = {}

    const { getBlockWithRetry } = this
    this.getBlockWithRetry = number => {
      let cached = this.blockPromiseCache[number]
      if (!cached) {
        cached = this.blockPromiseCache[number] = getBlockWithRetry.call(this, number)
      }

      return cached
    }

    this.on('block:number', n => this.prefetch())
    this.ready = this._init()
    this._lastSynced = 0
    this._stopped = false
  }

  async _init () {
    await Promise.all([
      this.eth.ensureCorrectNetwork(this.network),
      this._loadLatestBlockNumber(),
      this._loadSavedBlockNumber(),
    ])

    this.logger.debug(`monitoring blockchain...
  tip: ${this.latestBlockNumber}
  processed height: ${this.savedBlockNumber}`)

    this.subHeader = this.web3.subscribe('newBlockHeaders')
    this.subHeader.on('data', this._onBlockHeader.bind(this))
    this.subHeader.on('error', err => this.emit('error', err))

    // not supported yet
    // this.subSync = this.web3.subscribe('syncing')
    // this.subSync.on('data', this._onSync.bind(this))
    // this.subSync.on('error', err => this.emit('error', err))
    // in case events stop coming in
    this._pollForBlocks()
    this.prefetch()
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
    const n = await this.eth.getAvailableBlockNumber()
    this._lastSynced = Date.now()
    this._setLatestBlockNumber(n)
  }

  _setLatestBlockNumber(n) {
    if (typeof this.latestBlockNumber === 'number' && n <= this.latestBlockNumber) return

    this.latestBlockNumber = n
    this.logger.debug(`latest available block: ${n}`)
    this.emit('block:number', n)
  }

  async _loadSavedBlockNumber() {
    const cur = await this.state.getBlockNumber()
    const prev = this.savedBlockNumber || cur
    this.savedBlockNumber = cur

    for (let i = prev; i <= cur; i++) {
      delete this.blockPromiseCache[i]
    }
  }

  async _waitForBlock(number) {
    await this.ready
    await waitForEvent(this, 'block:number', (event, n) => n >= number)
  }

  _onBlockHeader({ number }) {
    this._setLatestBlockNumber(number)
  }

  // _onSync({ knownStates }) {
  //   this._setLatestBlockNumber(knownStates)
  //   this.emit(`block:number`, knownStates)
  // }

  async prefetch(n=this.blocksToBuffer) {
    this.logger.debug(`prefetching ${n} blocks`)
    // one at a time
    let i = 0
    const start = this.savedBlockNumber
    while (i++ < n) {
      await this.getBlockWithRetry(start + i)
    }
  }

  async getNextBlocks({ n, confirmationHeight }) {
    await this.ready
    await this._loadSavedBlockNumber()
    const lastNumber = this.savedBlockNumber + n
    const bufferedHeight = this.latestBlockNumber - lastNumber
    if (bufferedHeight < confirmationHeight) {
      const targetBlock = lastNumber + confirmationHeight
      const reason = `configurated confirmationHeight: ${confirmationHeight}, batchSize: ${n}`
      this.logger.debug(`waiting for block ${targetBlock} (${reason})`)
      await this._waitForBlock(targetBlock)
    }

    let nextNumber = this.savedBlockNumber
    const blocks = []
    while (++nextNumber <= lastNumber) {
      blocks.push(await this.getBlockWithRetry(nextNumber))
    }

    return blocks
  }

  async getNextBlock({ confirmationHeight }) {
    const blocks = await this.getNextBlocks({ n: 1, confirmationHeight })
    return blocks[0]
  }

  async getBlockWithRetry(number) {
    while (true) {
      try {
        return await this.eth.getBlock(number)
      } catch (err) {
        Errors.rethrow(err, 'system')
        this.logger.debug(`block ${number} not available yet`)
        await Promise.delay(1000)
      }
    }
  }

  async stop() {
    this._stopped = true
    await this.ready
    await Promise.all([
      this.subHeader.unsubscribe(),
      // this.subSync.unsubscribe(),
    ])
  }
}

const createBlocks = opts => new Blocks(opts)

module.exports = {
  create: createBlocks,
}
