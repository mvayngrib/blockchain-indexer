const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const withDefaultsDeep = require('lodash/defaultsDeep')
const networks = require('./networks')
const { assertOptionType } = require('./utils')
const getNetworkNames = () => Object.keys(networks).join(', ')
const validate = opts => {
  // {
  //   dir,
  //   port,
  //   node,
  //   network,
  //   blocksPerBatch,
  //   blockTime,
  //   confirmationHeight,
  //   startBlock
  // }

  const { network, storage } = opts
  if (!(network in networks)) {
    throw new Error(`network doesn't exist: ${network}
try one of: ${getNetworkNames()}`)
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
    assertOptionType(opts, 'node', 'object')
    if (opts.node.host) {
      assertOptionType(opts.node, 'host', 'string')
    }

    assertOptionType(opts.node, 'wsPort', 'number')
    assertOptionType(opts.node, 'httpPort', 'number')
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

const fromDir = baseDir => {
  if (!baseDir) {
    throw new Error('expected base directory string')
  }

  return fromPath(path.resolve(baseDir, 'conf.json'))
}

const fromPath = filePath => {
  let conf
  try {
    conf = fs.readFileSync(filePath, { encoding: 'utf8' })
    conf = JSON.parse(conf)
  } catch (err) {
    throw new Error('expected conf.json. See conf-sample.js')
  }

  conf = withDefaultsDeep(fromEnv(), conf)
  return fromJson(conf)
}

const fromJson = conf => {
  validate(conf)

  conf = { ...conf }
  if (!conf.dir.startsWith('/')) {
    conf.dir = path.resolve(process.cwd(), conf.dir)
  }

  conf.dbPath = `addr-tx-index-${conf.network}.db`
  conf.chainDir = path.resolve(conf.dir, 'chaindb')

  mkdirp.sync(conf.chainDir)
  return conf
}

const maybeParseNum = n => isNaN(n) ? undefined : Number(n)

const fromEnv = (env=process.env) => ({
  network: env.NODE_NETWORK,
  node: {
    host: env.NODE_HOST
  },
  confirmationHeight: maybeParseNum(env.CONFIRMATION_HEIGHT),
  startBlock: maybeParseNum(env.START_BLOCK),
})

module.exports = {
  validate,
  fromDir,
  fromPath,
  fromJson,
  fromEnv,
}
