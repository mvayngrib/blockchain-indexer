const Promise = require('bluebird')
const transform = require('lodash/transform')
const pump = require('pump')
const through = require('through2')
const Errors = require('@tradle/errors')
const schema = require('./schema')
const createLogger = require('./logger').create
const {
  unprefixHex,
  hexToBuf,
  bufToHex,
  assertHex,
} = require('./utils')

const BLOCK_NUMBER_KEY = 'blockNumber'
const createAddress = () => ({
  txHashes: []
})

const wrapWithArgTransformer = (transformer, target) => {
  if (typeof target === 'function') {
    return (...args) => target(...args.map(transformer))
  }

  return transform(target, (result, value, key) => {
    if (typeof value === 'function') {
      result[key] = wrapWithArgTransformer(transformer, value)
    } else {
      result[key] = value
    }
  })
}

const unprefixer = val => typeof val === 'string' ? unprefixHex(val) : val
const bufferize = val => typeof val === 'string' ? new Buffer(unprefixHex(val), 'hex') : val
const wrapWithUnprefixer = fn => wrapWithArgTransformer(unprefixer, fn)

const createState = (dbs) => {
  const logger = createLogger('state')
  const addressDB = dbs.addresses
  // const txDB = dbs.txs
  const stateDB = dbs.state

  // private
  const putAddress = async (address, data) => {
    assertHex(address)
    const buf = schema.address.encode(data)
    await addressDB.put(address, buf)
  }

  // private
  const addTxToAddress = async (address, hash) => {
    assertHex(address)
    assertHex(hash)
    const data = (await getAddress(address)) || createAddress()
    data.txHashes.push(hash)
    await putAddress(address, data)
  }

  const getBlockNumber = async () => {
    const n = await stateDB.get(BLOCK_NUMBER_KEY)
    return typeof n === 'number' ? n : -1
  }

  const setBlockNumber = number => stateDB.put(BLOCK_NUMBER_KEY, number)
  const getAddress = async address => {
    assertHex(address)
    const buf = await addressDB.get(address)
    return buf && schema.address.decode(buf)
  }

  // const getTx = async hash => {
  //   assertHex(hash)
  //   const buf = await txDB.get(hash)
  //   return buf && schema.tx.decode(buf)
  // }

  const addTx = async tx => {
    let { hash, from, to } = tx

    hash = unprefixHex(hash)
    from = unprefixHex(from)
    to = unprefixHex(to)

    await Promise.all([
      addTxToAddress(from, hash),
      addTxToAddress(to, hash),
    ])
  }

  const ensureIsNextBlock = async number => {
    const currentNumber = await getBlockNumber()
    const expected = currentNumber + 1
    if (number !== expected) {
      throw new Error(`expected block ${expected}, got ${number}`)
    }
  }

  const addBlock = async block => {
    const { number, transactions } = block
    logger.debug(`adding block ${number} with ${transactions.length} transactions`)
    await ensureIsNextBlock(number)
    await Promise.all(block.transactions.map(tx => addTx(tx)))
    await setBlockNumber(number)
  }

  const listTxsForAddress = async address => {
    assertHex(address)
    try {
      const { txHashes=[] } = (await getAddress(address)) || {}
      return txHashes
    } catch (err) {
      Errors.rethrow(err, 'system')
      return []
    }
  }

  const createReadStream = () => {
    return pump(
      addressDB.createReadStream(),
      through.obj((data, enc, cb) => {
        const { key, value } = data
        cb(null, {
          key: bufToHex(key),
          value: schema.address.decode(value),
        })
      })
    )
  }

  return {
    getBlockNumber,
    getAddress: wrapWithUnprefixer(getAddress),
    // putAddress: wrapWithUnprefixer(putAddress),
    // getTx: wrapWithUnprefixer(getTx),
    addTx: wrapWithUnprefixer(addTx),
    addBlock: wrapWithUnprefixer(addBlock),
    listTxsForAddress: wrapWithUnprefixer(listTxsForAddress),
    createReadStream,
    // addTxToAddress: wrapWithUnprefixer(addTxToAddress),
  }
}

module.exports = {
  create: createState,
}
