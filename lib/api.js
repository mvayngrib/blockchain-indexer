
const create = ({ ethApi, state }) => ({
  // web3 proxy
  getTransaction: ethApi.getTransaction,
  getBalance: ethApi.getBalance,
  getBlockNumber: ethApi.getBlockNumber,
  // state
  getAddress: state.getAddress,
  getProcessedHeight: state.getBlockNumber,
})

module.exports = {
  create,
}
