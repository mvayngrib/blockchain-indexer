const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const networks = require('./networks')
const { assertOptionType } = require('./utils')

const validate = opts => {
  // {
  //   dir,
  //   port,
  //   network,
  //   blocksPerBatch,
  //   blockTime,
  //   confirmationHeight,
  //   startBlock
  // }

  const { network } = opts
  if (!(network in networks)) {
    throw new Error(`network doesn't exist: ${network}`)
  }

  assertOptionType(opts, 'confirmationHeight', 'number')
  assertOptionType(opts, 'startBlock', 'number')
  assertOptionType(opts, 'blocksPerBatch', 'number')
  if (network === 'private') {
    if (!opts.blockTime) {
      throw new Error('expected number "blockTime" in seconds')
    }
  } else if (typeof port !== 'number') {
    assertOptionType(opts, 'port', 'number')
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
