
const Web3 = require('web3-eth')
const defaults = require('./defaults')

const create = ({ port }=defaults.web3) => {
  const web3 = new Web3(`http://localhost:${port}`)
  return web3
}

module.exports = {
  create,
}
