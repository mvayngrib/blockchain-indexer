const getWeb3 = require('./web3')
const createState = require('../state').create
const { prefixHex, isAddressHash } = require('../utils')
const { usingLevelDBFromPath } = require('../dbs')
const createStateFromDBPath = dbPath => createState(usingLevelDBFromPath(dbPath))
const getAddress = async ({ dbPath }, { hash }) => {
  const state = createStateFromDBPath(dbPath)
  return await state.getAddress(hash)
}

const getTx = async (conf, { hash }) => {
  const web3 = getWeb3(conf)
  return await web3.getTransaction(prefixHex(hash))
}

const get = (conf, argv) => {
  if (isAddressHash(argv.hash)) {
    return getAddress(conf, argv)
  }

  return getTx(conf, argv)
}

module.exports = {
  get,
  getTx,
  getAddress,
}
