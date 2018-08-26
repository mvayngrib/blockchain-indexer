const transform = require('lodash/transform')
// const sortedUniq = require('lodash/sortedUniq')
// const mergeSorted = require('merge-sorted')
const createLogger = require('./logger').create
const {
  unprefixHex,
  assertOptionType,
} = require('./utils')

const { ignoreNotFound } = require('./errors')
const assertBlock = block => {
  try {
    assertOptionType(block, 'number', 'number')
    block.transactions.forEach(tx => assertTx(tx))
  } catch (err) {
    throw new Error(`invalid block: ${err.message}`)
  }
}

const assertTx = tx => {
  try {
    assertOptionType(tx, 'from', 'string')
    assertOptionType(tx, 'hash', 'string')
    if (tx.to) {
      assertOptionType(tx, 'to', 'string')
    }
  } catch (err) {
    throw new Error(`invalid tx: ${err.message}`)
  }
}

const isSendEtherTx = tx => tx.from && tx.to
const createAddress = () => ({
  txsIn: [],
  txsOut: [],
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

const createState = ({ storage, startBlock=0 }) => {
  const logger = createLogger('state')
  // private
  // const putAddress = async (address, data) => {
  //   assertHex(address)
  //   const buf = schema.address.encode(data)
  //   await storage.put(address, buf)
  // }

  const getTxFromToAndHash = tx => ({
    from: unprefixHex(tx.from),
    to: unprefixHex(tx.to),
    hash: unprefixHex(tx.hash),
  })

  const mapTxsToAddresses = txs => txs.reduce((map, tx) => {
    const { blockNumber } = tx
    const { from, to, hash } = getTxFromToAndHash(tx)
    if (!map[from]) map[from] = createAddress()
    if (!map[to]) map[to] = createAddress()

    map[from].txsOut.push({ hash, blockNumber })
    map[to].txsIn.push({ hash, blockNumber })
    return map
  }, {})

  // private
  // const addTxsToAddress = async ({ address, txsIn=[], txsOut=[] }) => {
  //   assertHex(address)
  //   ;[txsIn, txsOut].forEach(assertHexArr)
  //   const data = (await getAddress(address)) || createAddress()
  //   data.txsIn = data.txsIn.concat(txsIn)
  //   data.txsOut = data.txsOut.concat(txsOut)
  //   await putAddress(address, data)
  // }

  const getBlockNumber = async () => {
    let n
    try {
      n = await storage.getBlockNumber()
    } catch (err) {
      ignoreNotFound(err)
    }

    if (typeof n === 'number') {
      return Math.max(n, startBlock - 1)
    }

    return startBlock - 1
  }

  // const maybeGetAddress = address => getAddress(address).catch(ignoreNotFound)

  // const getTx = async hash => {
  //   assertHex(hash)
  //   const buf = await txDB.get(hash)
  //   return buf && schema.tx.decode(buf)
  // }

  // const addTx = async tx => {
  //   let { hash, from, to } = tx

  //   hash = unprefixHex(hash)
  //   from = unprefixHex(from)
  //   to = unprefixHex(to)

  //   if (from === to) {
  //     await addTxsToAddress({
  //       address: from,
  //       txsIn: [hash],
  //       txsOut: [hash],
  //     })
  //   } else {
  //     await Promise.all([
  //       addTxsToAddress({
  //         address: from,
  //         txsOut: [hash],
  //       }),
  //       addTxsToAddress({
  //         address: to,
  //         txsIn: [hash],
  //       })
  //     ])
  //   }
  // }

  const ensureIsNextBlock = async number => {
    const currentNumber = await getBlockNumber()
    const expected = currentNumber + 1
    if (number > expected) {
      throw new Error(`expected block ${expected}, got ${number}`)
    }
  }

  const addBlocks = async blocks => {
    blocks.forEach(block => assertBlock(block))
    const firstNumber = blocks[0].number
    const lastNumber = blocks[blocks.length - 1].number
    const txs = blocks
      .reduce((txs, block) => txs.concat(block.transactions), [])
      .filter(isSendEtherTx)

    const range = blocks.length === 1 ? firstNumber : `${firstNumber}-${lastNumber}`
    if (!txs.length) {
      logger.debug(`skipping empty blocks ${range}`)
      await storage.setBlockNumber(lastNumber)
      return
    }

    logger.debug(`adding ${blocks.length} blocks (${range}) with ${txs.length} transactions`)
    await ensureIsNextBlock(firstNumber)
    await storage.updateAddresses(mapTxsToAddresses(txs))
    // await Promise.all(txs.map(tx => addTx(tx)))
    await storage.setBlockNumber(lastNumber)
  }

  return {
    addBlocks,
    getBlockNumber,
    setBlockNumber: storage.setBlockNumber,
    getAddress: wrapWithUnprefixer(storage.getAddress),
    createReadStream: storage.createReadStream,
  }
}

module.exports = {
  create: createState,
}
