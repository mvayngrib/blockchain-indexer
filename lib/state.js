const Promise = require('bluebird')
const transform = require('lodash/transform')
const Errors = require('@tradle/errors')
const schema = require('./schema')
const { createTrie } = require('./trie')
const { unprefixHex } = require('./utils')
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
const wrapWithUnprefixer = fn => wrapWithArgTransformer(unprefixer, fn)

const createState = (dbs) => {
  const txTrie = createTrie(dbs.txs)
  const addressTrie = createTrie(dbs.addresses)
  const getBlockNumber = () => dbs.state.get(BLOCK_NUMBER_KEY)
  const setBlockNumber = number => dbs.state.put(BLOCK_NUMBER_KEY, number)
  const getAddress = async address => {
    const buf = await addressTrie.get(address)
    return buf && schema.address.decode(buf)
  }

  const putAddress = async (address, data) => {
    const buf = schema.address.encode(data)
    await addressTrie.put(address, buf)
  }

  const getTx = async hash => {
    const buf = await txTrie.get(hash)
    return buf && schema.tx.decode(buf)
  }

  const putTx = async (hash, tx) => {
    const { from, to } = tx
    const buf = schema.tx.encode(tx)
    await Promise.all([
      txTrie.put(hash, buf),
      addTxToAddress(unprefixHex(from), hash),
      addTxToAddress(unprefixHex(to), hash),
    ])
  }

  const listTxsForAddress = async address => {
    try {
      const { txHashes=[] } = (await getAddress(address)) || {}
      return txHashes
    } catch (err) {
      Errors.rethrow(err, 'system')
      return []
    }
  }

  const addTxToAddress = async (address, hash) => {
    const data = (await getAddress(address)) || createAddress()
    data.txHashes.push(hash)
    await putAddress(address, data)
  }

  return {
    getBlockNumber,
    getAddress: wrapWithUnprefixer(getAddress),
    putAddress: wrapWithUnprefixer(putAddress),
    getTx: wrapWithUnprefixer(getTx),
    putTx: wrapWithUnprefixer(putTx),
    listTxsForAddress: wrapWithUnprefixer(listTxsForAddress),
    addTxToAddress: wrapWithUnprefixer(addTxToAddress),
  }
}

module.exports = {
  create: createState,
}
