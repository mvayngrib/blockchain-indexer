
const Errors = require('@tradle/errors')
class NotFound extends Error {
  constructor(message) {
    super(`NotFound: ${message}`)
  }
}

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
  ignoreNotFound,
  ignoreNotConnected,
  isNotConnected,
}
