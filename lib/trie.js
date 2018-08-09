const Trie = require('merkle-patricia-tree')
const { promisify } = require('./utils')
const createTrie = db => {
  const trie = new Trie(db)
  return {
    get: promisify(trie.get.bind(trie)),
    put: promisify(trie.put.bind(trie)),
  }
}

module.exports = {
  createTrie,
}
