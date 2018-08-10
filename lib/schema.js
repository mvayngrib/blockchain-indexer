const clone = require('lodash/clone')
const {
  hexToBuf,
  hexsToBufs,
  bufToHex,
  bufsToHexs,
} = require('./utils')

// web3 tx
// {
//   "hash": "0x9fc76417374aa880d4449a1f7f31ec597f00b1f6f3dd2d66f4c9c6c445836d8b",
//   "blockNumber": 3,
//   "from": "0xa94f5374fce5edbc8e2a8697c15331677e6ebf0b",
//   "to": "0x6295ee1b4f6dd65047762f924ecd367c17eabf8f",
//   "value": '123450000000000000',
//   "nonce": 2,
//   "blockHash": "0xef95f2f1ed3ca60b048b4bf67cde2195961e0bba6f70bcbea9a2c4e133e34b46",
//   "transactionIndex": 0,
//   "gas": 314159,
//   "gasPrice": '2000000000000',
//   "input": "0x57cb2fc4"
// }

const schema = require('protocol-buffers')(`
  message Address {
    repeated bytes txsIn = 1;
    repeated bytes txsOut = 2;
  }

  message Tx {
    required bytes hash = 1;
    required int32 blockNumber = 2;
    required bytes from = 3;
    required bytes to = 4;
    required int32 value = 5;
    optional int32 nonce = 6;
    optional bytes input = 7;
  }
`)

const maybeify = fn => val => val ? fn(val) : undefined
const maybeHexToBuf = maybeify(hexToBuf)
const maybeHexsToBufs = maybeify(hexsToBufs)
const maybeBufToHex = maybeify(bufToHex)
const maybeBufsToHexs = maybeify(bufsToHexs)
const addressHexProps = []
const addressHexArrProps = ['txsIn', 'txsOut']
const encodeAddress = data => {
  data = clone(data)
  addressHexProps.forEach(prop => {
    data[prop] = maybeHexToBuf(data[prop])
  })

  addressHexArrProps.forEach(prop => {
    data[prop] = maybeHexsToBufs(data[prop])
  })

  return schema.Address.encode(data)
}

const decodeAddress = buf => {
  const data = schema.Address.decode(buf)
  addressHexProps.forEach(prop => {
    data[prop] = maybeBufToHex(data[prop])
  })

  addressHexArrProps.forEach(prop => {
    data[prop] = maybeBufsToHexs(data[prop])
  })

  return data
}

const txHexProps = ['hash', 'from', 'to', 'input']
const encodeTx = data => {
  data = clone(data)
  txHexProps.forEach(prop => {
    data[prop] = maybeHexToBuf(data[prop])
  })

  return schema.Tx.encode(data)
}

const decodeTx = buf => {
  const data = schema.Tx.decode(buf)
  txHexProps.forEach(prop => {
    data[prop] = maybeBufToHex(data[prop])
  })

  return data
}

const address = {
  encode: encodeAddress,
  decode: decodeAddress,
}

const tx = {
  encode: encodeTx,
  decode: decodeTx,
}

module.exports = {
  address,
  tx,
}
