const Promise = require('bluebird')
const level = require('level')
const sub = require('subleveldown')
const chunk = require('lodash/chunk')
const pump = require('pump')
const through = require('through2')
const Errors = require('@tradle/errors')
const schema = require('../schema')
const { NotFound, ignoreNotFound } = require('../errors')
const {
  promisify,
  assertHex,
  bufToHex,
  hexToBuf,
} = require('../utils')

const BINARY_DB_OPTS = {
  keyEncoding: 'binary',
  valueEncoding: 'binary',
}

const STATE_DB_OPTS = {
  keyEncoding: 'utf8',
  valueEncoding: 'json'
}

const BLOCK_NUMBER_KEY = 'blockNumber'
const ADDRESS_UPDATE_BATCH_SIZE = 50

const wrapGetNormalizeErr = get => async function (...args) {
  try {
    return await get.apply(this, args)
  } catch (err) {
    Errors.ignore(err, { name: 'NotFoundError' })
    throw new NotFound(err.message)
  }
}

const wrapDB = db => {
  const pdb = promisify(db, {
    include: ['get', 'put', 'del', 'batch', 'close']
  })

  pdb.get = wrapGetNormalizeErr(pdb.get.bind(pdb))
  pdb.createReadStream = db.createReadStream.bind(db)
  return pdb
}

const createBinaryStreamer = db => () => {
  return pump(
    db.createReadStream(),
    through.obj((data, enc, cb) => {
      const { key, value } = data
      cb(null, {
        key: bufToHex(key),
        value: schema.address.decode(value),
      })
    })
  )
}

const withBinaryKeys = db => ({
  get: key => db.get(hexToBuf(key)),
  put: (key, value) => db.put(hexToBuf(key), value),
  batch: batch => db.batch(batch.map(({ key, ...rest }) => ({
    ...rest,
    key: hexToBuf(key),
  }))),
  createReadStream: createBinaryStreamer(db),
})

const mergeTxHashes = (old, update) => old.concat(update)

// const lexiCompare = (a, b) => {
//   if (a === b) return 0
//   if (a < b) return -1
//   return 1
// }

// const lexisort = arr => arr.sort(lexiCompare)
// const mergeTxHashesWithSort = (old, update) => {
//   if (!update.length) return old
//   if (!old.length) return update

//   const merged = mergeSorted(old, lexisort(update), lexiCompare)
//   return sortedUniq(merged)
// }

// const fixAddress = addr => ({
//   ...addr,
//   txsIn: lexisort(addr.txsIn),
//   txsOut: lexisort(addr.txsOut),
// })

const mergeAddress = (old, update) => ({
  ...old,
  ...update,
  txsIn: mergeTxHashes(old.txsIn, update.txsIn),
  txsOut: mergeTxHashes(old.txsOut, update.txsOut),
})

const fromDB = db => {
  const addresses = withBinaryKeys(wrapDB(sub(db, 'a', BINARY_DB_OPTS)))
  const state = wrapDB(sub(db, 's', STATE_DB_OPTS))
  const updateAddresses = async addressMap => {
    const batches = chunk(Object.keys(addressMap), ADDRESS_UPDATE_BATCH_SIZE)
    return Promise.mapSeries(batches, async keys => {
      const stored = await Promise.all(keys.map(maybeGetAddress))
      const updates = keys.map(addr => addressMap[addr])
      const merged = stored.map((old, i) => {
        const update = updates[i]
        return old ? mergeAddress(old, update) : update
      })

      const batch = merged.map((info, i) => ({
        type: 'put',
        key: keys[i],
        value: schema.address.encode(merged[i]),
      }))

      await addresses.batch(batch)
    })
  }

  const maybeGetAddress = address => getAddress(address).catch(ignoreNotFound)
  const getAddress = async address => {
    assertHex(address)
    const buf = await addresses.get(address)
    return schema.address.decode(buf)
  }

  const getBlockNumber = () => state.get(BLOCK_NUMBER_KEY)
  const setBlockNumber = n => state.put(BLOCK_NUMBER_KEY, n)
  return {
    getBlockNumber,
    setBlockNumber,
    updateAddresses,
    getAddress,
    createReadStream: addresses.createReadStream.bind(addresses),
    close: db.close,
  }
}

const fromPath = dbPath => fromDB(level(dbPath, BINARY_DB_OPTS))

module.exports = {
  fromDB,
  fromPath,
}
