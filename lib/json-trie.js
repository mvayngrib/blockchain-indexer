const flatten = require('lodash/flatten')
const cloneDeep = require('lodash/cloneDeep')
const setProp = require('lodash/setWith')
const getProp = require('lodash/get')
const traverse = require('traverse')
const create = () => fromJSON({})
const notImplemented = () => {
  throw new Error('not implemented yet')
}

const fromJSON = json => {
  const trie = cloneDeep(json)
  const keyToPath = key => key.split('')
  const keys = () => traverse(trie).reduce(function (leaves, val) {
    if (this.isLeaf) leaves.push(this.path.join(''))
    return leaves
  }, [])

  const put = (key, value) => setProp(trie, keyToPath(key), value, Object)
  const get = key => getProp(trie, keyToPath(key))
  const toJSON = () => cloneDeep(trie)
  return {
    get,
    put,
    keys,
    toJSON,
    toEfficientRepresentation: notImplemented,
    fromEfficientRepresentation: notImplemented,
  }
}

module.exports = {
  create,
  fromJSON,
}
