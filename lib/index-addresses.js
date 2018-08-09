const createBlockProcessor = require('./block-processor').create
const createLogger = require('./logger').create
const createEmitter = require('./emitter').create
const createAddressIndexer = ({ state, processor, confirmationHeight }) => {
  const ee = createEmitter()
  const logger = createLogger('addressIndexer')
  let stopped
  ee.start = async () => {
    let block
    while (!stopped) {
      block = await processor.getNextBlock({ confirmationHeight })
      await state.addBlock(block)
      ee.emit('block:number', block.number)
    }
  }

  ee.stop = () => stopped = true
  return ee
}

module.exports = {
  createAddressIndexer,
}
