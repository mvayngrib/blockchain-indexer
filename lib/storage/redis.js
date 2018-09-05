const Promise = require('bluebird')
const once = require('lodash/once')
const Errors = require('../errors')
const redis = require('../redis')
const { serialize, unserialize } = require('../serialization')
const {
  intToBuf,
  bufToInt,
  bufToHex,
  blockNumberToHex,
} = require('../utils')

const BLOCK_NUMBER = 'blockNumber'
const defaultOpts = { return_buffers: true }
const createClient = ({
  port=6380,
  hostname='localhost',
  network,
}) => {
  const client = redis.createClient(port, hostname, {
    ...defaultOpts,
    prefix: network + ':'
  })

  // eslint-disable-next-line no-console
  client.on('error', err => console.error(`redis error: ${err.message}`))

  return client
}

const TX_IN = '00'
const TX_OUT = '01'

const serializeRow = (blockNumber, hash, inbound) => serialize.generic([
  blockNumber == null ? null : blockNumberToHex(blockNumber),
  inbound == null
    ? null
    : inbound ? TX_IN : TX_OUT,
  hash,
])

const unserializeRow = buf => {
  const [blockNumber, inbound, hash] = unserialize.generic(buf)
  return {
    blockNumber: bufToInt(blockNumber),
    hash: bufToHex(hash),
    inbound: bufToHex(inbound) === TX_IN
  }
}

const fromClient = client => {
  const updateAddresses = async addresses => {
    const multi = client.multi()
    for (let address in addresses) {
      let { txs } = addresses[address]
      txs.forEach(({ hash, blockNumber, inbound }) =>
        multi.sadd(address, serializeRow(blockNumber, hash, inbound)))
    }

    await multi.execAsync()
  }

  const getList = key => client.smembersAsync(key)

  const startFromBlock = (txs, blockNumber) => {
    let idx = txs.findIndex(tx => tx.blockNumber > blockNumber)
    if (idx === -1) idx = 0

    return txs.slice(idx)
  }

  const getAddress = async ({ address, blockNumber=0, limit }) => {
    if (limit && limit !== Infinity) {
      throw new Errors.InvalidInput('"limit" not supported')
    }

    let txs = await getList(address)
    txs = parseTxs(txs)
    if (!txs.length) {
      return { txs: [] }
    }

    if (blockNumber) {
      txs = startFromBlock(txs, blockNumber)
    }

    return { txs }
  }

  const parseTxs = bufs => bufs.map(unserializeRow)

  const getBlockNumber = async () => {
    const val = await client.getAsync(BLOCK_NUMBER)
    if (val == null) throw new Errors.NotFound('stored block number')

    if (Buffer.isBuffer(val)) {
      return bufToInt(val)
    }

    return isNaN(val) ? -1 : parseInt(val, 10)
  }

  const setBlockNumber = n => client.setAsync(BLOCK_NUMBER, intToBuf(n))

  const close = once(() => Promise.resolve(client.quit()))
  return {
    getBlockNumber,
    setBlockNumber,
    updateAddresses,
    getAddress,
    close,
  }
}

const create = opts => fromClient(createClient(opts))

module.exports = {
  create,
  createClient,
  fromClient,
}
