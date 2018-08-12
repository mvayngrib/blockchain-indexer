const Promise = require('bluebird')
const level = require('level')
const sub = require('subleveldown')
const flatMap = require('lodash/flatMap')
const partition = require('lodash/partition')
const _collect = require('stream-collector')
const Errors = require('@tradle/errors')
const { NotFound } = require('../errors')
const {
  promisify,
  assertHex,
  bufToHex,
  hexToBuf,
  pluck,
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

const withBinaryKeys = db => ({
  get: key => db.get(hexToBuf(key)),
  put: (key, value) => db.put(hexToBuf(key), value),
  batch: batch => db.batch(batch.map(({ key, ...rest }) => ({
    ...rest,
    key: hexToBuf(key),
  }))),
  createKeyStream: (opts={}) => db.createReadStream({ ...opts, keys: true, values: false }),
})

const TX_IN = '00'
const TX_OUT = '01'
const END_BRACKET = '02'
const VALUE_PLACEHOLDER = Buffer.from([])
const ADDR_LENGTH = 40
const ENTRY_TYPE_LENGTH = TX_IN.length
const parseKey = key => {
  key = bufToHex(key)
  return {
    address: key.slice(0, ADDR_LENGTH),
    in: key.slice(ADDR_LENGTH, ADDR_LENGTH + ENTRY_TYPE_LENGTH) === TX_IN,
    txHash: key.slice(ADDR_LENGTH + ENTRY_TYPE_LENGTH),
  }
}

const countTxs = addr => addr.txsIn.length + addr.txsOut.length
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

const fromDB = db => {
  const addresses = withBinaryKeys(wrapDB(sub(db, 'a', BINARY_DB_OPTS)))
  const state = wrapDB(sub(db, 's', STATE_DB_OPTS))
  const updateAddresses = async addressMap => {
    const batches = batchify(addressMap, TXS_PER_BATCH)
    return Promise.mapSeries(batches, async addrs => {
      const batch = flatMap(addrs, address => {
        const { txsIn, txsOut } = addressMap[address]
        const i = txsIn.map(hash => ({
          type: 'put',
          key: `${address}${TX_IN}${hash}`,
          value: VALUE_PLACEHOLDER,
        }))

        const o = txsOut.map(hash => ({
          type: 'put',
          key: `${address}${TX_OUT}${hash}`,
          value: VALUE_PLACEHOLDER,
        }))

        return i.concat(o)
      })

      await addresses.batch(batch)
    })
  }

  // const maybeGetAddress = address => getAddress(address).catch(ignoreNotFound)
  const getAddress = async address => {
    assertHex(address)
    const keys = await collect(addresses.createKeyStream({
      gte: hexToBuf(address),
      lte: hexToBuf(address + END_BRACKET),
    }))

    if (!keys.length) {
      throw new NotFound(`address ${address}`)
    }

    const [i, o] = partition(keys.map(parseKey), 'in')
    return {
      txsIn: pluck(i, 'txHash'),
      txsOut: pluck(o, 'txHash'),
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
