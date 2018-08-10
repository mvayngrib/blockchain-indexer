
const Errors = require('@tradle/errors')
class NotFound extends Error {}

const ignoreNotFound = err => Errors.ignore(err, NotFound)

module.exports = {
  NotFound,
  ignoreNotFound,
}
