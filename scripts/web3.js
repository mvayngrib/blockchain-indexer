/* eslint-disable */

const get = require('lodash/get')
const Web3 = require('web3-eth')
const web3 = new Web3('http://localhost:8545')
const [method, ...args] = process.argv.slice(2)

const fn = get(web3, method).bind(web3)
fn(...args)
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(console.error)

// oops! why not just use web3??
// const fetch = require('node-fetch')
// const shortMethod = process.argv[2]
// const methodToParams = {
//   blockNumber: [],
//   getTransactionByHash: [
//     process.argv[3]
//   ]
// }

// if (!(shortMethod in methodToParams)) {
//   throw new Error('method not found')
// }

// const method = `eth_${shortMethod}`
// const params = methodToParams[shortMethod]
// const data = {
//   jsonrpc: '2.0',
//   method,
//   params,
//   id: 1
// }

// const exec = async () => {
//   const res = await fetch('http://localhost:8545', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify(data)
//   })

//   if (res.status !== 200) {
//     throw new Error(res.responseText)
//   }

//   return await res.json()
// }

// exec()
//   .then(result => console.log(JSON.stringify(result, null, 2)))
//   .catch(console.error)
