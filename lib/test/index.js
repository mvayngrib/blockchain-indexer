const crypto = require('crypto')
const test = require('tape')
// const _memdown = require('memdown')
// const _encodingdown = require('encoding-down')
// const memdown = (...args) => _encodingdown(_memdown(...args))
const memdown = require('memdown')
const levelup = require('levelup')
const Web3 = require('web3')
const TestRPC = require('ethereumjs-testrpc')
const createProcessor = require('../processor').create
const { fromLevelDB } = require('../db')
const jsonTrie = require('../json-trie')
const createState = require('../state').create
const { unprefixHex } = require('../utils')
const createLogger = require('../logger').create
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
    console.error(err)
    throw err
  }
}

const alphabetical = (a, b) => a === b ? 0 : a < b ? -1 : 1
const hashes = [
  '13df354190fbf78f14624fa798fc60344f24a2b6a4f80e1424bcb0a67890f874',
  '22412097c32cc6efe55c2d9d32a858e0a5be2b8e000146c2fbec3ec8fbfbf626',
  '39683fc9b4438dc6b637272de1d1e44ef903fab20ad25867cba57b15fcab6798',
  '605292e5bd4cfb2a94b761e9ec6b1bfafdf8f57bfe608f34868adb8e4c86a1d3',
  '60fdafb21a623450d3e46ef6460e5414dec2a69fcc67ea246c172583ae6a0065',
  '73366da4411c3846f2f78feb1fc76b2fe3a757d3e344a6aa6006b699a3a915a2',
  '9486a5a35311ad5325f770bc15d8ee86a3ea6f90d652d759dc0f2b17f7d53280',
  'a98928e8be98813cf491a850de5f270a949f4449b6bce8f1f1fe42f861a0e4f6',
  'b984d276e329f6114611c9311f765638067cdcea87ae0ad2ff5ed87f6a4af573',
  'd87c76db98c623998dd56e989e800a65ac48e9116d516ab9eb45cd3add0118da'
]

test('json-trie', t => {
  const trie = jsonTrie.create()
  hashes.forEach(hash => {
    trie.put(hash, hash)
    t.equal(trie.get(hash), hash)
  })

  t.same(trie.keys().sort(alphabetical), hashes.sort(alphabetical))
  t.end()
})

test('state', loudAsync(async t => {
  const state = createInMemoryState()
  await state.putTx(txFixture.hash, txFixture)
  t.same(await state.listTxsForAddress(txFixture.from), [txFixture.hash].map(unprefixHex))
  t.same(await state.listTxsForAddress(txFixture.to), [txFixture.hash].map(unprefixHex))
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
