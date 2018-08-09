const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const networks = require('./networks')
const validate = ({ dir, port, network, blockTime }) => {
  if (!(network in networks)) {
    throw new Error(`network doesn't exist: ${network}`)
  }

  if (network === 'private') {
    if (!blockTime) {
      throw new Error('expected number "blockTime" in seconds')
    }
  } else if (typeof port !== 'number') {
    throw new Error('expected number "port"')
  }
}

const load = (baseDir=path.resolve(process.cwd())) => {
  let conf
  try {
    conf = fs.readFileSync(path.resolve(baseDir, 'conf.json'), { encoding: 'utf8' })
    conf = JSON.parse(conf)
  } catch (err) {
    throw new Error('expected conf.json. See conf-sample.js')
  }

  validate(conf)

  if (!conf.dir.startsWith('/')) {
    conf.dir = path.resolve(process.cwd(), conf.dir)
  }

  conf.dbPath = `ethernode-${conf.network}.db`
  conf.chainDir = path.resolve(conf.dir, 'chaindb')

  mkdirp.sync(conf.chainDir)
  return conf
}

module.exports = {
  validate,
  load,
}
