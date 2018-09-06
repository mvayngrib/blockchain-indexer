const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const yn = require('yn')
const withDefaultsDeep = require('lodash/defaultsDeep')
const networks = require('./networks')
const { assertOptionType, pickNonNull } = require('./utils')
const Errors = require('./errors')
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
    throw new Errors.InvalidInput(`network doesn't exist: ${network}
try one of: ${getNetworkNames()}`)
  }

  assertOptionType(opts, 'confirmationHeight', 'number')
  assertOptionType(opts, 'startBlock', 'number')
  assertOptionType(opts, 'blocksPerBatch', 'number')
  assertOptionType(opts, 'port', 'number')
  if (network === 'private') {
    if (!opts.blockTime) {
      throw new Errors.InvalidInput('expected number "blockTime" in seconds')
    }
  } else {
    assertOptionType(opts, 'node', 'object')
    assertOptionType(opts.node, 'hostname', 'string')
    if ('useWS' in opts.node) {
      assertOptionType(opts.node, 'useWS', 'boolean')
    }

    assertOptionType(opts.node, 'wsPort', 'number')
    assertOptionType(opts.node, 'httpPort', 'number')
  }

  if (storage) {
    if (storage === 'redis') {
      assertOptionType(opts, 'redis', 'object')
      assertOptionType(opts.redis, 'port', 'number')
    } else if (storage !== 'leveldb') {
      throw new Errors.InvalidInput('unsupported "storage" option, expected "leveldb" or "redis"')
    }
  }

  if ('web3Concurrency' in opts) {
    assertOptionType(opts, 'web3Concurrency', 'number')
  }

  if ('prefixPathWithNetworkName' in opts) {
    assertOptionType(opts, 'prefixPathWithNetworkName', 'boolean')
  }

  if ('serverBasePath' in opts) {
    assertOptionType(opts, 'serverBasePath', 'string')
  }
}

const fromDir = baseDir => {
  if (!baseDir) {
    throw new Errors.InvalidInput('expected base directory string')
  }

  return fromPath(path.resolve(baseDir, 'conf.json'))
}

const fromPath = filePath => {
  let conf
  try {
    conf = fs.readFileSync(filePath, { encoding: 'utf8' })
    conf = JSON.parse(conf)
  } catch (err) {
    throw new Errors.InvalidInput('expected conf.json. See conf-sample.js')
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

const fromEnv = (env=process.env) => pickNonNull({
  dir: env.DATA_DIR,
  network: env.NODE_NETWORK,
  node: {
    hostname: env.NODE_HOSTNAME,
    httpPort: maybeParseNum(env.NODE_HTTP_PORT),
    wsPort: maybeParseNum(env.NODE_WS_PORT),
    useWS: !!yn(env.NODE_USE_WS),
  },
  serverBasePath: env.SERVER_BASE_PATH,
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
