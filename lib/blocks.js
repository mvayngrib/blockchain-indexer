const Promise = require('bluebird')
const omit = require('lodash/omit')
const createHooks = require('event-hooks')
const Errors = require('@tradle/errors')
const { EventEmitter } = require('./emitter')
const networks = require('./networks')
const {
  prefixHex,
  assertOptionType,
} = require('./utils')

const createLogger = require('./logger').create
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

const ensureCorrectNetwork = async (web3, network) => {
  const id = networks[network].network_id
  const actual = await web3.net.getId()
  if (network === 'private') {
    const ok = Object.keys(omit(networks, 'private'))
      .every(({ network_id }) => actual !== network_id)

    if (!ok) {
      throw new Error(`expected private network, got network id: ${actual}`)
    }
  } else if (actual !== id) {
    throw new Error(`expected network with id ${id}, actually on ${actual}`)
  }
}

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

const wrapWeb3Caller = fn => (...args) => tryWeb3(wrap(fn, args))
const tryWeb3 = async (fn) => {
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

const getAvailableBlockNumber = async web3 => {
  let syncing
  while (!syncing) {
    syncing = await web3.isSyncing()
    if (syncing === false) {
      return getBlockNumber(web3)
    }
  }

  return syncing.pulledStates || syncing.currentBlock
}

const getBlock = async (web3, number) => {
  const block = await web3.getBlock(number, true)
  if (!block) {
    throw new Error(`block not found with number ${number}`)
  }

  return block
}

const getBlockNumber = web3 => web3.getBlockNumber()
const createEthApi = web3 => ({
  ensureCorrectNetwork: wrapWeb3Caller(ensureCorrectNetwork.bind(null, web3)),
  getBlock: wrapWeb3Caller(getBlock.bind(null, web3)),
  getBlockNumber: wrapWeb3Caller(getBlockNumber),
  getAvailableBlockNumber: wrapWeb3Caller(getAvailableBlockNumber.bind(null, web3)),
  getTx: wrapWeb3Caller(web3.getTransaction.bind(web3)),
})

class Blocks extends EventEmitter {
  constructor(opts) {
    super({
      wildcard: true,
      delimiter: ':',
    })

    const { web3, state, network } = opts
    assertOptionType(opts, 'web3', 'object')
    assertOptionType(opts, 'state', 'object')
    assertOptionType(opts, 'network', 'string')

    // this.setMaxListeners(0)
    this.web3 = web3
    this.eth = createEthApi(web3)
    this.state = state
    this.network = network
    this.networkId = networks[network].network_id
    this.logger = createLogger('s')
    this.hooks = createHooks()
    this.hook = this.hooks.hook
    this.empty = Promise.resolve()
    this.waiters = {}
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

    // this.subSync = this.web3.subscribe('syncing')
    // this.subSync.on('data', this._onSync.bind(this))
    // this.subSync.on('error', err => this.emit('error', err))
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
    const n = await this.eth.getAvailableBlockNumber()
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
    this.emit('block:number', number)
  }

  // _onSync({ knownStates }) {
  //   this._setLatestBlockNumber(knownStates)
  //   this.emit(`block:number`, knownStates)
  // }

  async getNextBlocks({ n, confirmationHeight }) {
    await this.ready
    await this._loadSavedBlockNumber()
    const lastNumber = this.savedBlockNumber + n
    const bufferedHeight = this.latestBlockNumber - lastNumber
    if (bufferedHeight < confirmationHeight) {
      await this._waitForBlock(lastNumber + confirmationHeight)
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

  async getTx(hash) {
    return await this.eth.getTx(prefixHex(hash))
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
