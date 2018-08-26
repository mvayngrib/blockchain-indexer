const omit = require('lodash/omit')
const partition = require('lodash/partition')
const jsend = require('jsend')
// const wrapJSONRPC = fn => async (...args) => {
//   const resp = await fn(...args)
//   const { result, error } = resp
//   if (error) {
//     return jsend.error(error)
//   }

//   return jsend.success(result)
// }

const jsendify = fn => async (...args) => {
  try {
    return jsend.success(await fn(...args))
  } catch (err) {
    return jsend.error(err.message)
  }
}

const returnAsProp = (fn, prop) => (...args) => fn(...args).then(result => ({ [prop]: result }))

const stripInbound = tx => omit(tx, 'inbound')
const wrapGetAddress = getAddress => async (...args) => {
  const result = await getAddress(...args)
  const [txsIn, txsOut] = partition(result.txs, 'inbound')
  return {
    ...omit(result, 'txs'),
    txsIn: txsIn.map(stripInbound),
    txsOut: txsOut.map(stripInbound),
  }
}

const create = ({ ethApi, state }) => ({
  // web3 proxy
  getTransaction: jsendify(ethApi.getTransaction),
  getBalance: jsendify(returnAsProp(ethApi.getBalance, 'balance')),
  getBlockNumber: jsendify(returnAsProp(ethApi.getBlockNumber, 'blockNumber')),
  sendSignedTransaction: jsendify(returnAsProp(ethApi.sendSignedTransaction, 'hash')),
  // state
  getAddress: jsendify(wrapGetAddress(state.getAddress)),
  getProcessedBlockNumber: jsendify(returnAsProp(state.getBlockNumber, 'blockNumber')),
})

module.exports = {
  create,
}
