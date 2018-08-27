const Promise = require('bluebird')
const level = require('level')
const sub = require('subleveldown')
const flatMap = require('lodash/flatMap')
const omit = require('lodash/omit')
const _collect = require('stream-collector')
const Errors = require('../errors')
const { serialize, unserialize } = require('../serialization')
const {
  promisify,
  assertHex,
  hexToBuf,
} = require('../utils')

const collect = promisify(_collect)
const BINARY_DB_OPTS = {
  keyEncoding: 'binary',
  valueEncoding: 'binary',
}

const STATE_DB_OPTS = {
  keyEncoding: 'utf8',
  valueEncoding: 'json'
}

const BLOCK_NUMBER_KEY = 'blockNumber'
// const ADDRESS_UPDATE_BATCH_SIZE = 50
const TXS_PER_BATCH = 150
const MAX_BLOCK_NUM = 4294967295 // parseInt('ffffff', 16)

const wrapGetNormalizeErr = get => async function (...args) {
  try {
    return await get.apply(this, args)
  } catch (err) {
    Errors.ignore(err, { name: 'NotFoundError' })
    throw new Errors.NotFound(err.message)
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

const withBinaryKeys = db => ({
  get: key => db.get(hexToBuf(key)),
  put: (key, value) => db.put(hexToBuf(key), value),
  batch: batch => db.batch(batch.map(({ key, ...rest }) => ({
    ...rest,
    key: hexToBuf(key),
  }))),
  createKeyStream: (opts={}) => db.createReadStream({ ...opts, keys: true, values: false }),
})

const countTxs = addr => addr.txs.length
const batchify = (addressMap, updatesPerBatch) => {
  const batches = []
  const batch = []
  let txCount = 0
  for (let addr in addressMap) {
    batch.push(addr)
    txCount += countTxs(addressMap[addr])
    if (txCount > updatesPerBatch) {
      batches.push(batch.slice())
      batch.length = 0
      txCount = 0
    }
  }

  if (batch.length) {
    batches.push(batch)
  }

  return batches
}

const VALUE_PLACEHOLDER = Buffer.from([])

const fromDB = db => {
  const addresses = withBinaryKeys(wrapDB(sub(db, 'a', BINARY_DB_OPTS)))
  const state = wrapDB(sub(db, 's', STATE_DB_OPTS))
  const createPut = ({ address, blockNumber, hash, inbound }) => ({
    type: 'put',
    key: serialize.addrToTxMapping({ address, blockNumber, hash, inbound }),
    value: VALUE_PLACEHOLDER,
  })

  const updateAddresses = async addressMap => {
    const batches = batchify(addressMap, TXS_PER_BATCH)
    return Promise.mapSeries(batches, async addrs => {
      const batch = flatMap(addrs, address => {
        const { txs } = addressMap[address]
        return txs.map(tx => createPut({ ...tx, address }))
      })

      await addresses.batch(batch)
    })
  }

  const stripAddress = obj => omit(obj, 'address')

  // const maybeGetAddress = address => getAddress(address).catch(ignoreNotFound)
  const getAddress = async ({ address, blockNumber=0, limit }) => {
    assertHex(address)
    const gte = serialize.addrToTxMapping({ address, blockNumber })
    const lte = serialize.addrToTxMapping({ address, blockNumber: MAX_BLOCK_NUM })
    const keys = await collect(addresses.createKeyStream({ gte, lte, limit }))
    if (!keys.length) {
      return {
        txs: []
      }
    }

    const txs = keys.map(unserialize.addrToTxMapping)
    return {
      txs: txs.map(stripAddress)
    }
  }

  const getBlockNumber = () => state.get(BLOCK_NUMBER_KEY)
  const setBlockNumber = n => state.put(BLOCK_NUMBER_KEY, n)
  return {
    getBlockNumber,
    setBlockNumber,
    updateAddresses,
    getAddress,
    // createReadStream: addresses.createReadStream.bind(addresses),
    close: db.close,
  }
}

const fromPath = dbPath => fromDB(level(dbPath, BINARY_DB_OPTS))

module.exports = {
  fromDB,
  fromPath,
}
