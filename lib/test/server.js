const withDefaults = require('lodash/defaults')
const TestRPC = require('ganache-cli')
const defaultOpts = {
  blockTime: 1,
  network_id: 100
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
