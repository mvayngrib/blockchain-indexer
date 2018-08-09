const path = require('path')
const DEFAULT_PORT = 8485
const web3 = {
  port: DEFAULT_PORT,
  // network_id: 1, // main
  network_id: 4, // rinkeby
}

const ganache = {
  // 1 / second
  // networkId: 100,
  blockTime: 2,
  db_path: path.resolve(process.cwd(), 'chaindb'),
}

module.exports = {
  web3,
  ganache,
}
