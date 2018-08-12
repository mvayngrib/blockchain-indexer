const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const networks = require('./networks')
const { assertOptionType } = require('./utils')

const validate = opts => {
  // {
  //   dir,
  //   port,
  //   nodeWSPort,
  //   network,
  //   blocksPerBatch,
  //   blockTime,
  //   confirmationHeight,
  //   startBlock
  // }

  const { network, storage } = opts
  if (!(network in networks)) {
    throw new Error(`network doesn't exist: ${network}`)
  }

  assertOptionType(opts, 'confirmationHeight', 'number')
  assertOptionType(opts, 'startBlock', 'number')
  assertOptionType(opts, 'blocksPerBatch', 'number')
  assertOptionType(opts, 'port', 'number')
  if (network === 'private') {
    if (!opts.blockTime) {
      throw new Error('expected number "blockTime" in seconds')
    }
  } else {
    assertOptionType(opts, 'nodeWSPort', 'number')
    assertOptionType(opts, 'nodeHTTPPort', 'number')
  }

  if (storage) {
    if (storage === 'redis') {
      assertOptionType(opts, 'redis', 'object')
      assertOptionType(opts.redis, 'port', 'number')
    } else if (storage !== 'leveldb') {
      throw new Error('unsupported "storage" option, expected "leveldb" or "redis"')
    }
  }
}

const load = baseDir => {
  if (!baseDir) {
    throw new Error('expected base directory string')
  }

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
