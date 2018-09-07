const Promise = require('bluebird')
const createHooks = require('event-hooks')
const pLimit = require('p-limit')
const debounce = require('lodash/debounce')
const Errors = require('@tradle/errors')
const { EventEmitter } = require('./emitter')
const {
  isNotConnected,
} = require('./errors')

const {
  assertOptionType,
  retry,
} = require('./utils')

const createLogger = require('./logger').create
const POLLING_INTERVAL = 6000
const DEFAULT_BUFFER = 1000
const BLOCK_FETCH_BATCH_SIZE = 20

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

    assertOptionType(opts, 'ethApi', 'object')
    assertOptionType(opts, 'state', 'object')
    assertOptionType(opts, 'network', 'string')
    // assertOptionType(opts, 'blocksToBuffer', 'number')

    const { ethApi, state, network, blocksToBuffer=DEFAULT_BUFFER } = opts

    // this.setMaxListeners(0)
    this.eth = ethApi
    this.state = state
    this.network = network
    this.blocksToBuffer = blocksToBuffer
    this.logger = createLogger('blocks')
    this.hooks = createHooks()
    this.hook = this.hooks.hook
    this.empty = Promise.resolve()
    this.waiters = {}
    this.blockPromiseCache = new Map()
    this.prefetch = oneAtATimify(this.prefetch.bind(this))
    const { getBlock } = this
    this.getBlock = number => {
      let cached = this.blockPromiseCache.get(number)
      if (!cached) {
        cached = getBlock.call(this, number)
        this.blockPromiseCache.set(number, cached)
      }

      return cached
    }

    this.on('block:number', debounce(() => this.prefetch(), 1, { leading: true, trailing: false }))
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

    this._logState()
    if (this.eth.canSubscribe) {
      this.subHeader = this.eth.subscribeToNewBlockHeaders()
      this.subHeader.on('data', this._onBlockHeader.bind(this))
      this.subHeader.on('error', err => {
        if (!isNotConnected(err)) this.emit('error', err)
      })
    }

    // not supported yet
    // this.subSync = this.web3.subscribe('syncing')
    // this.subSync.on('data', this._onSync.bind(this))
    // this.subSync.on('error', err => this.emit('error', err))
    // in case events stop coming in
    this._pollForBlocks()
    this.prefetch()
  }

  _logState() {
    this.logger.debug(`monitoring blockchain...
  tip: ${this.latestBlockNumber}
  processed height: ${this.savedBlockNumber}`)
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
      this.blockPromiseCache.delete(i)
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
    const start = this.savedBlockNumber
    const end = start + n

    let prefetchCount = 0
    let i = start
    while (i++ < end) {
      if (!this.blockPromiseCache.has(i)) {
        prefetchCount++
      }
    }

    if (!prefetchCount) return

    this.logger.debug(`prefetching ${prefetchCount} blocks`)

    i = start
    let batchSize
    while (i < end) {
      batchSize = Math.min(BLOCK_FETCH_BATCH_SIZE, end - i)
      if (batchSize <= 0) break

      await this.getBlocks(i + 1, batchSize)
      i += batchSize
      // TODO: rely on eth.js to throttle/queue up calls
      // await this.getBlock(start + i)
    }
  }

  async getBlocks(from, count) {
    const promises = []
    for (let i = 0; i < count; i++) {
      promises.push(this.getBlock(from + i))
    }

    return Promise.all(promises)
  }

  async getNextBlocks({ maxBatchSize, confirmationHeight }) {
    await this.ready
    await this._loadSavedBlockNumber()
    const bufferedHeight = this.latestBlockNumber - this.savedBlockNumber
    const minBufferedHeight = confirmationHeight + 1
    if (bufferedHeight < minBufferedHeight) {
      const targetBlock = this.savedBlockNumber + minBufferedHeight
      const reason = `configured confirmationHeight: ${confirmationHeight}, maxBatchSize: ${maxBatchSize}`
      this.logger.debug(`waiting for block ${targetBlock} (${reason})`)
      await this._waitForBlock(targetBlock)
    }

    const n = Math.min(this.latestBlockNumber - this.savedBlockNumber - confirmationHeight, maxBatchSize)
    return this.getBlocks(this.savedBlockNumber + 1, n)
  }

  async getNextBlock({ confirmationHeight }) {
    const blocks = await this.getNextBlocks({ n: 1, confirmationHeight })
    return blocks[0]
  }

  async getBlock(number) {
    return await retry(() => this.eth.getBlock(number), {
      initialDelay: 1000,
      maxDelay: 30000,
      maxAttempts: Infinity,
      // logger: this.logger,
      shouldRetry: err => {
        Errors.rethrow(err, 'system')
        // this.logger.debug(`block ${number} not available yet`)
        return true
      },
    })
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
const oneAtATimify = fn => {
  const oneAtATime = pLimit(1)
  return () => oneAtATime(fn)
}


module.exports = {
  create: createBlocks,
}
