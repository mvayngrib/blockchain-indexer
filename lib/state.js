const Promise = require('bluebird')
const transform = require('lodash/transform')
const chunk = require('lodash/chunk')
// const sortedUniq = require('lodash/sortedUniq')
// const mergeSorted = require('merge-sorted')
const pump = require('pump')
const through = require('through2')
const schema = require('./schema')
const createLogger = require('./logger').create
const {
  unprefixHex,
  bufToHex,
  assertHex,
  assertOptionType,
} = require('./utils')

const { ignoreNotFound } = require('./errors')

// const assertHexArr = arr => arr.forEach(hash => assertHex(hash))
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

const BLOCK_NUMBER_KEY = 'blockNumber'
const ADDRESS_UPDATE_BATCH_SIZE = 50
const isSendEtherTx = tx => tx.from && tx.to
const createAddress = () => ({
  txsIn: [],
  txsOut: [],
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

const createState = ({ addresses, state, startBlock=0 }) => {
  const logger = createLogger('state')
  // private
  // const putAddress = async (address, data) => {
  //   assertHex(address)
  //   const buf = schema.address.encode(data)
  //   await addresses.put(address, buf)
  // }

  const getTxFromToAndHash = tx => ({
    from: unprefixHex(tx.from),
    to: unprefixHex(tx.to),
    hash: unprefixHex(tx.hash),
  })

  const mapTxsToAddresses = txs => txs.reduce((map, tx) => {
    const { from, to, hash } = getTxFromToAndHash(tx)
    if (!map[from]) map[from] = createAddress()
    if (!map[to]) map[to] = createAddress()

    map[from].txsOut.push(hash)
    map[to].txsIn.push(hash)
    return map
  }, {})

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

      return addresses.batch(batch)
    })
  }

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
      n = await state.get(BLOCK_NUMBER_KEY)
    } catch (err) {
      ignoreNotFound(err)
    }

    if (typeof n === 'number') {
      return Math.max(n, startBlock - 1)
    }

    return startBlock - 1
  }

  const setBlockNumber = number => state.put(BLOCK_NUMBER_KEY, number)
  const getAddress = async address => {
    assertHex(address)
    const buf = await addresses.get(address)
    return schema.address.decode(buf)
  }

  const maybeGetAddress = address => getAddress(address).catch(ignoreNotFound)

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
    logger.debug(`adding ${blocks.length} blocks (${range}) with ${txs.length} transactions`)
    await ensureIsNextBlock(firstNumber)
    await updateAddresses(mapTxsToAddresses(txs))
    // await Promise.all(txs.map(tx => addTx(tx)))
    await setBlockNumber(lastNumber)
  }

  const createReadStream = () => {
    return pump(
      addresses.createReadStream(),
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
    addBlocks: wrapWithUnprefixer(addBlocks),
    createReadStream,
  }
}

module.exports = {
  create: createState,
}
