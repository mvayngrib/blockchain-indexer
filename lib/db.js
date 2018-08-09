const pick = require('lodash/pick')
const level = require('level')
const sub = require('subleveldown')
const { promisify } = require('./utils')
const DB_OPTS = {
  keyEncoding: 'utf8',
  valueEncoding: 'binary',
}

const wrap = db => promisify(db, {
  include: ['get', 'put', 'del']
})

const fromLevelDB = db => {
  return {
    addresses: wrap(sub(db, 'a', DB_OPTS)),
    txs: wrap(sub(db, 't', DB_OPTS)),
    state: wrap(sub(db, 's', DB_OPTS)),
  }
}

const levelDBFromPath = dbPath => exports.fromLevelDB(level(dbPath, DB_OPTS))

module.exports = {
  fromLevelDB,
  levelDBFromPath,
}
