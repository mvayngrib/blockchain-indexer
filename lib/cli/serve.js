const createEmitter = require('../emitter').create
const createComponents = require('../')

const serve = (conf, opts={}) => {
  const ee = createEmitter()
  const { indexer } = createComponents(conf, opts)
  if (indexer) {
    indexer.on('**', function (data) {
      const { event } = this
      if (event === 'error') {
        ee.emit(event, data)
      } else {
        // logger.info(event, prettify(data))
      }
    })

    indexer.start()
  }

  return ee
}

module.exports = {
  serve,
}
