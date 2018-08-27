const crypto = require('crypto')
const test = require('tape')
const memdown = require('memdown')
const levelup = require('levelup')
const pick = require('lodash/pick')
// const createProcessor = require('../processor').create
const { fromDB } = require('../storage/leveldb.js')
const createState = require('../state').create
const { unprefixHex } = require('../utils')
// const createLogger = require('../logger').create
const txFixture = require('./fixtures/tx')
const txFixtureUnprefixed = {
  ...txFixture,
  hash: unprefixHex(txFixture.hash),
  from: unprefixHex(txFixture.from),
  to: unprefixHex(txFixture.to),
}

const createInMemoryState = () => {
  const rootDB = levelup(memdown(crypto.randomBytes(20).toString('hex')))
  const storage = fromDB(rootDB)
  return createState({ storage })
}

const loudAsync = asyncFn => async (...args) => {
  try {
    return await asyncFn(...args)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err)
    throw err
  }
}

test('state', loudAsync(async t => {
  const state = createInMemoryState()
  t.same(await state.getAddress({ address: txFixture.from }), { txs: [] })

  await state.addBlocks([
    {
      number: 0,
      transactions: [txFixture]
    }
  ])

  const txs = [pick(txFixtureUnprefixed, ['blockNumber', 'hash'])]
  t.same(await state.getAddress({ address: txFixture.from }), {
    txs: txs.map(tx => ({ ...tx, inbound: false }))
  })

  t.same(await state.getAddress({ address: txFixture.to }), {
    txs: txs.map(tx => ({ ...tx, inbound: true }))
  })

  t.end()
}))

// test('processor', loudAsync(async t => {
//   const web3 = new Web3()
//   web3.setProvider(TestRPC.provider())
//   const state = createInMemoryState()
//   const logger = createLogger()
//   const processor = createProcessor({
//     web3,
//     state,
//     logger,
//   })

//   processor.
// }))
