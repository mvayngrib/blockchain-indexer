const Promise = require('bluebird')
const omit = require('lodash/omit')

const returnAsProp = (fn, prop) => (...args) => fn(...args).then(result => ({ [prop]: result }))

const create = ({ ethApi, state }) => {
  const { getTransaction } = ethApi
  const getAddress = async ({ address, blockNumber, lookupTxs  }) => {
    const result = await state.getAddress({ address, blockNumber })
    let { txs } = result
    if (lookupTxs) {
      txs = await Promise.map(txs, async tx => getTransaction(tx.hash))
    } else {
      txs = result.txs.map(tx => ({
        ...omit(tx, 'inbound'),
        from: tx.inbound ? null : address,
        to: tx.inbound ? address : null,
      }))
    }

    return { ...result, txs }
  }

  const getAddresses = async ({ addresses, blockNumber, lookupTxs }) => {
    const result = await Promise.map(addresses, address => getAddress({ address, blockNumber, lookupTxs }))
    return result.reduce((byAddr, info, i) => {
      byAddr[addresses[i]] = info
      return byAddr
    }, {})
  }

  return {
    // web3 proxy
    getTransaction,
    getBalance: returnAsProp(ethApi.getBalance, 'balance'),
    getBlockNumber: returnAsProp(ethApi.getBlockNumber, 'blockNumber'),
    sendSignedTransaction: returnAsProp(ethApi.sendSignedTransaction, 'hash'),
    // state
    getProcessedBlockNumber: returnAsProp(state.getBlockNumber, 'blockNumber'),
    // state / web3 hybrid
    getAddress,
    getAddresses,
  }
}

module.exports = {
  create,
}
