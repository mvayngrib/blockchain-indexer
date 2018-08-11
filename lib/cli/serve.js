const createEmitter = require('../emitter').create
const createComponents = require('./components').fromConf

const serve = conf => {
  const ee = createEmitter()
  const { indexer, } = createComponents(conf, {
    state: true,
    api: true,
    indexer: true,
    server: typeof conf.port === 'number',
  })

  indexer.on('**', function (data) {
    const { event } = this
    if (event === 'error') {
      ee.emit(event, data)
    } else {
      // logger.info(event, prettify(data))
    }
  })

  indexer.start()
  return ee
}

module.exports = {
  serve,
}
