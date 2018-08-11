
const create = ({ ethApi, state }) => ({
  getTx: ethApi.getTx,
  getAddress: state.getAddress,
})

module.exports = {
  create,
}
