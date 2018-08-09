const createEmitter = require('./emitter').create
const createAddressIndexer = ({ state, processor, confirmationHeight }) => {
  const ee = createEmitter()
  let stopped
  ee.start = async () => {
    stopped = false
    let block
    while (!stopped) {
      try {
        block = await processor.getNextBlock({ confirmationHeight })
      } catch (err) {
        ee.emit('error', err)
        stopped = true
        break
      }

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
