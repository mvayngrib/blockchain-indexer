const EventEmitter = require('eventemitter2').EventEmitter2
const opts = {
  wildcard: true,
  delimiter: ':',
}

const createEmitter = () => new EventEmitter(opts)

module.exports = {
  create: createEmitter,
  EventEmitter,
}
