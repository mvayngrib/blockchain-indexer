// const net = require('net')
const Web3 = require('web3-eth')
const WS_OPTS = {
  timeout: 30000,
  headers: {
    Origin: 'http://localhost'
  }
}

const create = ({ port }) => {
  const provider = new Web3.providers.WebsocketProvider(`ws://localhostlib/web3.js:${port}`, WS_OPTS)
  return new Web3(provider)
}

module.exports = {
  create,
}
