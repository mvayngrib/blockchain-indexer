const withDefaults = require('lodash/defaults')
const TestRPC = require('ganache-cli')
const defaults = require('../defaults')
const defaultOpts = {
  blockTime: 1,
  ...defaults.web3,
}

const serve = opts => {
  opts = withDefaults(opts, defaultOpts)
  const server = TestRPC.server(opts)
  server.listen(opts.port, function (err) {
    if (err) throw err
  })

  return () => server.close()
}

module.exports = {
  serve,
}
