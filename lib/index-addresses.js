const createEmitter = require('./emitter').create
const createAddressIndexer = ({
  state,
  processor,
  blocksPerBatch,
  confirmationHeight,
}) => {
  const ee = createEmitter()
  let stopped
  ee.start = async () => {
    stopped = false
    let blocks
    while (!stopped) {
      try {
        blocks = await processor.getNextBlocks({ n: blocksPerBatch, confirmationHeight })
      } catch (err) {
        ee.emit('error', err)
        stopped = true
        break
      }

      await state.addBlocks(blocks.slice())
      blocks.forEach(block => ee.emit('block:number', block.number))
    }
  }

  ee.stop = () => stopped = true
  return ee
}

module.exports = {
  createAddressIndexer,
}
