const Promise = require('bluebird')
const omit = require('lodash/omit')
const transform = require('lodash/transform')
const {
  prefixHex
} = require('./utils')

const networks = require('./networks')
const getNetworkNameById = id => Object.keys(networks)
  .find(name => networks[name].network_id === id) || 'private'

const ensureCorrectNetwork = async (web3, network) => {
  const id = networks[network].network_id
  const actual = await web3.net.getId()
  if (network === 'private') {
    const ok = Object.keys(omit(networks, 'private'))
      .every(({ network_id }) => actual !== network_id)

    if (!ok) {
      throw new Error(`expected private network, got network id: ${actual}`)
    }
  } else if (actual !== id) {
    const actualName = getNetworkNameById(actual)
    throw new Error(`expected network "${network}", actually on "${actualName}"`)
  }
}

// {
//   startingBlock: 100,
//   currentBlock: 312,
//   highestBlock: 512,
//   knownStates: 234566,
//   pulledStates: 123455
// }

const wrap = (fn, args) => {
  const wrapped = () => fn(...args)
  wrapped._originalName = fn.name
  return wrapped
}

const curryArg = (arg, fn) => (...args) => fn(arg, ...args)
const wrapWithCxnCheck = fn => (...args) => tryWeb3Call(wrap(fn, args))
const isNotConnected = err => {
  const message = err.message.toLowerCase()
  if (message.startsWith('invalid json rpc response') || message.startsWith('connection not open')) {
    return true
  }
}

const tryWeb3Call = async (fn) => {
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (isNotConnected(err)) {
        // eslint-disable-next-line no-console
        console.warn(`${fn._originalName}: are you sure your ethereum node is running? I'll try again in a bit...`)
        await Promise.delay(5000)
        continue
      }

      throw err
    }
  }
}

const getAvailableBlockNumber = async web3 => {
  let syncing
  while (!syncing) {
    syncing = await web3.isSyncing()
    if (syncing === false) {
      return getBlockNumber(web3)
    }
  }

  return syncing.pulledStates || syncing.currentBlock
}

const getBlock = async (web3, number) => {
  const block = await web3.getBlock(number, true)
  if (!block) {
    throw new Error(`block not found with number ${number}`)
  }

  return block
}

const getBlockNumber = web3 => web3.getBlockNumber()
const getTx = async (web3, hash) => {
  const tx = await web3.getTransaction(prefixHex(hash))
  if (!tx) {
    throw new Error(`tx not found with hash ${hash}`)
  }

  return tx
}

const wrapEthEpi = (web3, api) => transform(api, (wrapper, fn, name) => {
  wrapper[name] = curryArg(web3, wrapWithCxnCheck(fn))
})

const fromWeb3 = web3 => wrapEthEpi(web3, {
  ensureCorrectNetwork,
  getBlock,
  getBlockNumber,
  getAvailableBlockNumber,
  getTx,
})

module.exports = {
  fromWeb3,
}
