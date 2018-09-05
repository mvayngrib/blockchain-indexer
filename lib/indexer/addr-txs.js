const createEmitter = require('../emitter').create
const createAddressIndexer = ({
  state,
  processor,
  blocksPerBatch,
  confirmationHeight,
  logger,
}) => {
  const ee = createEmitter()
  let stopped = true
  ee.start = async () => {
    if (!stopped) return

    stopped = false
    let blocks
    let totalBlocks = 0
    let startTime = Date.now()

    // reset periodically so average is not weighed down by the past too much
    setInterval(() => {
      const secondsPassed = (Date.now() - startTime) / 1000
      logger.log('blocks per second:', totalBlocks / secondsPassed)
      startTime = Date.now()
      totalBlocks = 0
    }, 10000).unref()

    while (!stopped) {
      try {
        blocks = await processor.getNextBlocks({ maxBatchSize: blocksPerBatch, confirmationHeight })
      } catch (err) {
        ee.emit('error', err)
        stopped = true
        break
      }

      await state.addBlocks(blocks.slice())
      blocks.forEach(block => ee.emit('block:number', block.number))
      totalBlocks += blocks.length
    }
  }

  ee.stop = () => stopped = true
  return ee
}

module.exports = {
  createAddressIndexer,
}
