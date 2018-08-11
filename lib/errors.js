
const Errors = require('@tradle/errors')
class NotFound extends Error {
  constructor(message) {
    super(`NotFound: ${message}`)
  }
}

const ignoreNotFound = err => Errors.ignore(err, NotFound)

module.exports = {
  NotFound,
  ignoreNotFound,
}
