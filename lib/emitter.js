const { EventEmitter2 } = require('eventemitter2')

const createEmitter = () => new EventEmitter2({
  wildcard: true,
  delimiter: ':',
})

const EventEmitter = EventEmitter2

module.exports = {
  create: createEmitter,
  EventEmitter,
}
