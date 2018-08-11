const crypto = require('crypto')
const test = require('tape')
const memdown = require('memdown')
const levelup = require('levelup')
const Errors = require('@tradle/errors')
const { NotFound } = require('../errors')
// const createProcessor = require('../processor').create
const { fromLevelDB } = require('../dbs')
const createState = require('../state').create
const { unprefixHex } = require('../utils')
// const createLogger = require('../logger').create
const txFixture = require('./fixtures/tx')
const createInMemoryState = () => {
  const rootDB = levelup(memdown(crypto.randomBytes(20).toString('hex')))
  const dbs = fromLevelDB(rootDB)
  return createState(dbs)
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
  try {
    await state.getAddress(txFixture.from)
    t.fail('expected error')
  } catch (err) {
    t.ok(Errors.matches(err, NotFound))
  }

  await state.addBlocks([
    {
      number: 0,
      transactions: [txFixture]
    }
  ])

  const hashes = [txFixture.hash].map(unprefixHex)
  t.same(await state.getAddress(txFixture.from), {
    txsIn: [],
    txsOut: hashes
  })

  t.same(await state.getAddress(txFixture.to), {
    txsIn: hashes,
    txsOut: []
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
