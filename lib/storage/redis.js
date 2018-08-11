const Promise = require('bluebird')
const once = require('lodash/once')
const { NotFound } = require('../errors')
const redis = require('../redis')
const {
  bufToHex,
  hexToBuf,
} = require('../utils')

const BLOCK_NUMBER = 'blockNumber'
const defaultOpts = { return_buffers: true }
const createClient = ({
  port=6380,
  host='localhost',
  network,
}) => {
  const client = redis.createClient(port, host, {
    ...defaultOpts,
    prefix: network + ':'
  })

  // eslint-disable-next-line no-console
  client.on('error', err => console.error(`redis error: ${err.message}`))

  return client
}

const getTxsInKey = address => `${address}:i`
const getTxsOutKey = address => `${address}:o`

const fromClient = client => {
  const updateAddresses = async addresses => {
    const multi = client.multi()
    for (let address in addresses) {
      let { txsIn, txsOut } = addresses[address]
      txsIn.forEach(hash => multi.lpush(getTxsInKey(address), hexToBuf(hash)))
      txsOut.forEach(hash => multi.lpush(getTxsOutKey(address), hexToBuf(hash)))
    }

    await multi.execAsync()
  }

  const getList = key => client.lrangeAsync(key, '0', '-1')

  const getAddress = async address => {
    const { txsIn=[], txsOut=[] } = await Promise.props({
      txsIn: getList(getTxsInKey(address)),
      txsOut: getList(getTxsOutKey(address)),
    })

    if (!(txsIn.length || txsOut.length)) {
      throw new NotFound(`address ${address}`)
    }

    return {
      txsIn: parseTxs(txsIn),
      txsOut: parseTxs(txsOut),
    }
  }

  const parseTxs = hashes => hashes.map(bufToHex)

  const getBlockNumber = async () => {
    const val = await client.getAsync(BLOCK_NUMBER)
    if (val == null) throw new NotFound(`block with number ${BLOCK_NUMBER}`)

    // works for buffers too
    return isNaN(val) ? -1 : parseInt(val, 10)
  }

  const setBlockNumber = n => client.setAsync(BLOCK_NUMBER, n)
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
