module.exports = ({ testing }) => testing
  ? require('../test/web3').create()
  : require('../web3').create()

