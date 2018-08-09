const Promise = require('bluebird')
const omit = require('lodash/omit')
const Web3 = require('web3-eth')
const ganache = require('ganache-cli')
const DEFAULT_ACCOUNTS = require('./fixtures/accounts')

const create = opts => {
  // const createAccounts = n => new Array(n).fill(0).map(i => {
  //   const acc = web3.accounts.create()
  //   return {
  //     balance: '0x0000000000000056bc75e2d63100000',
  //     privateKey: acc.privateKey,
  //   }
  // })

  const web3 = new Web3()
  opts = {
    ...opts,
    accounts: opts.accounts || DEFAULT_ACCOUNTS
  }

  const { blockTime, accounts, dbPath } = opts
  const provider = ganache.provider({
    ...omit(opts, ['dbPath']),
    db_path: dbPath,
  })

  web3.setProvider(provider)

  const stop = genTransactions({
    web3,
    accounts,
    blockTime,
    txsPerBlock: 2,
  })

  return web3
}

const randomEl = arr => arr[Math.floor(Math.random() * arr.length)]

const genTransactions = ({ web3, accounts, blockTime, txsPerBlock }) => {
  let stopped
  const genTx = async (accounts) => {
    await web3.sendTransaction({
      from: randomEl(accounts),
      to: randomEl(accounts),
      value: '0x0000000000000000000000000100000'
    })
  }

  const run = async () => {
    const acc = await web3.getAccounts()
    while (!stopped) {
      let start = Date.now()
      let i = txsPerBlock
      while (i--) {
        await genTx(acc)
      }

      await Promise.delay(blockTime * 1000 / 2)
    }
  }

  run().catch(console.error)
  return () => stopped = true
}

module.exports = {
  create,
}
