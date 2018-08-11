
const create = ({ ethApi, state }) => ({
  getTx: ethApi.getTx,
  getAddress: state.getAddress,
  getHeight: state.getBlockNumber,
})

module.exports = {
  create,
}
