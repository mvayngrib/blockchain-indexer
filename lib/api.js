const jsend = require('jsend')
const wrapJSONRPC = fn => async (...args) => {
  const { result, error } = await fn(...args)
  if (error) {
    return jsend.error(error)
  }

  return jsend.success(result)
}

const jsendify = fn => async (...args) => {
  try {
    return jsend.success(await fn(...args))
  } catch (err) {
    return jsend.error(err.message)
  }
}

const create = ({ ethApi, state }) => ({
  // web3 proxy
  getTransaction: wrapJSONRPC(ethApi.getTransaction),
  getBalance: wrapJSONRPC(ethApi.getBalance),
  getBlockNumber: wrapJSONRPC(ethApi.getBlockNumber),
  sendSignedTransaction: wrapJSONRPC(ethApi.sendSignedTransaction),
  // state
  getAddress: jsendify(state.getAddress),
  getProcessedHeight: jsendify(state.getBlockNumber),
})

module.exports = {
  create,
}
