const omit = require('lodash/omit')
const block = require('./block')
module.exports = omit(block, ['uncles', 'transactions'])
