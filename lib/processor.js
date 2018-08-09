const Promise = require('bluebird')
const { EventEmitter } = require('./emitter')
const CONFIRMATION_HEIGHT = 15
// const Web3 = require('web3')
// const levelup = require('levelup')
// const levelup = require('levelup')

class Processor extends EventEmitter {
  constructor({ web3, state, logger, confirmationHeight=CONFIRMATION_HEIGHT }) {
    super()
    this.web3 = web3
    this.state = state
    this.logger = logger
    this.ready = this._init()
  }

  async _init () {
    this.subscription = this.web3.eth.subscribe('newBlockHeaders')
    this.subscription.on('data', data => this._processNewBlockHeaders(data))
    this.on('chain:height', async height => {
      await this.ready
      if (height - this.savedHeight > this.confirmationHeight) {
        const block = await this.web3.eth.getBlock(this.savedHeight + 1)
        await this.processBlock(block)
      }
    })

    Object.assign(this, await Promise.props({
      chainHeight: this.web3.eth.getBlockNumber(),
      savedHeight: this.state.getBlockNumber(),
    }))
  }

  _processNewBlockHeaders(data) {
    this.emit('chain:height', data.number)
  }

    // const diff = data.number - this.height
    // if (diff < this.confirmationHeight) {
    //   this.logger.debug('ignoring block for now')
    // }

  async processBlock (block) {
    debugger
    await this.ready
    if (block.height < this.height) {
      this.logger.debug(`ignoring past block`)
      return
    }
  }

  async stop() {
    await this.subscription.unsubscribe()
  }
}

// new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))

const createProcessor = opts => new Processor(opts)

module.exports = {
  create: createProcessor,
}
