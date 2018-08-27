const Promise = require('bluebird')
const omit = require('lodash/omit')

const returnAsProp = (fn, prop) => (...args) => fn(...args).then(result => ({ [prop]: result }))

const create = ({ ethApi, state }) => {
  const { getTransaction } = ethApi
  const getAddress = async ({ address, blockNumber, lookupTxs }, timeoutOpts) => {
    const result = await state.getAddress({ address, blockNumber })
    let { txs } = result
    if (lookupTxs) {
      txs = await Promise.map(txs, async tx => getTransaction(tx.hash, timeoutOpts))
    } else {
      txs = result.txs.map(tx => ({
        ...omit(tx, 'inbound'),
        from: tx.inbound ? null : address,
        to: tx.inbound ? address : null,
      }))
    }

    return { ...result, txs }
  }

  const getAddresses = async ({ addresses, ...opts }, timeoutOpts) => Promise.map(
    addresses,
    address => getAddress({ address, ...opts }, timeoutOpts)
  )

  const getTransactions = ({ hashes }, timeoutOpts) => Promise.map(
    hashes,
    hash => getTransaction(hash, timeoutOpts)
  )

  return {
    // web3 proxy
    getTransactions,
    getBalance: ethApi.getBalance,
    getBlockNumber: ethApi.getBlockNumber,
    sendSignedTransaction: ethApi.sendSignedTransaction,
    // state
    getProcessedBlockNumber: state.getBlockNumber,
    // state / web3 hybrid
    getAddress,
    getAddresses,
  }
}

module.exports = {
  create,
}
