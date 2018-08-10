const level = require('level')
const sub = require('subleveldown')
const Errors = require('@tradle/errors')
const {
  promisify,
  hexToBuf,
} = require('./utils')

const BINARY_DB_OPTS = {
  keyEncoding: 'binary',
  valueEncoding: 'binary',
}

const STATE_DB_OPTS = {
  keyEncoding: 'utf8',
  valueEncoding: 'json'
}

const wrapGetIgnoreNotFound = get => async function (...args) {
  try {
    return await get.apply(this, args)
  } catch (err) {
    Errors.ignore(err, { name: 'NotFoundError' })
  }
}

const wrapDB = db => {
  const pdb = promisify(db, {
    include: ['get', 'put', 'del', 'batch']
  })

  pdb.get = wrapGetIgnoreNotFound(pdb.get.bind(pdb))
  pdb.createReadStream = db.createReadStream.bind(db)
  return pdb
}

const withBinaryKeys = db => ({
  get: key => db.get(hexToBuf(key)),
  put: (key, value) => db.put(hexToBuf(key), value),
  batch: batch => {
    batch = batch.map(({ type, key, value }) => ({
      type,
      key: hexToBuf(key),
      value,
    }))

    return db.batch(batch)
  },
  createReadStream: db.createReadStream.bind(db),
})

const fromLevelDB = db => {
  return {
    addresses: withBinaryKeys(wrapDB(sub(db, 'a', BINARY_DB_OPTS))),
    // txs: withBinaryKeys(wrapDB(sub(db, 't', BINARY_DB_OPTS))),
    state: wrapDB(sub(db, 's', STATE_DB_OPTS)),
  }
}

const usingLevelDBFromPath = dbPath => fromLevelDB(level(dbPath, BINARY_DB_OPTS))

module.exports = {
  fromLevelDB,
  usingLevelDBFromPath,
}
