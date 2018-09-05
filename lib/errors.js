
const Errors = require('@tradle/errors')
class NotFound extends Error {
  constructor(message) {
    super(`not found: ${message}`)
    this.type = 'NotFound'
  }
}

class InvalidInput extends Error {
  constructor(message) {
    super(`invalid input: ${message}`)
    this.type = 'InvalidInput'
  }
}

class Timeout extends Error {
  constructor(message) {
    super(`timed out: ${message}`)
    this.type = 'Timeout'
  }
}

class InsufficientFunds extends Error {
  constructor(message) {
    super(message)
    this.type = 'InsufficientFunds'
  }
}

class Duplicate extends Error {
  constructor(message) {
    super(`duplicate: ${message}`)
    this.type = 'Timeout'
  }
}

const isNotFound = err => Errors.matches(err, NotFound)
const ignoreNotFound = err => Errors.ignore(err, NotFound)
const isNotConnected = err => {
  const message = err.message.toLowerCase()
  if (message.startsWith('invalid json rpc response') ||
    message.startsWith('connection not open') ||
    message.startsWith('connection timeout')) {
    return true
  }
}

const ignoreNotConnected = err => {
  if (!isNotConnected(err)) {
    throw err
  }
}

module.exports = {
  NotFound,
  InvalidInput,
  Timeout,
  InsufficientFunds,
  Duplicate,
  isNotFound,
  ignoreNotFound,
  ignoreNotConnected,
  isNotConnected,
  ignore: Errors.ignore,
  rethrow: Errors.rethrow,
  matches: Errors.matches,
}
