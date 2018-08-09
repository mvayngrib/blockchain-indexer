
const Web3 = require('web3-eth')

const create = ({ port }) => new Web3(`http://localhost:${port}`)

module.exports = {
  create,
}
