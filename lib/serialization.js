
const {
  bufToHex,
  hexToBuf,
  blockNumberToHex,
} = require('./utils')

const TX_IN = '00'
const TX_OUT = '01'

const serialize = {}
const unserialize = {}
const DEFAULT_BYTES_PER_LENGTH = 1
const PART_LENGTH_BYTES = DEFAULT_BYTES_PER_LENGTH
const readInt = (buf, idx, bytesPerLengthMarker) => {
  if (bytesPerLengthMarker === 1) {
    return buf.readUInt8(idx)
  }

  if (bytesPerLengthMarker <= 2 ) {
    return buf.readUInt16BE(idx)
  }

  if (bytesPerLengthMarker <= 4 ) {
    return buf.readUInt32BE(idx)
  }

  throw new Error('not supported')
}

const writeInt = (buf, length, idx, bytesPerLengthMarker) => {
  if (bytesPerLengthMarker === 1) {
    buf.writeUInt8(length, idx)
  } else if (bytesPerLengthMarker <= 2 ) {
    buf.writeUInt16BE(length, idx)
  } else if (bytesPerLengthMarker <= 4 ) {
    buf.writeUInt32BE(length, idx)
  } else {
    throw new Error('not supported')
  }
}

serialize.generic = (parts, bytesPerLengthMarker=DEFAULT_BYTES_PER_LENGTH) => {
  const bufs = []
  for (let part of parts) {
    if (part == null) break

    const len = new Buffer(PART_LENGTH_BYTES)
    if (typeof part === 'string') {
      part = hexToBuf(part)
    }

    writeInt(len, part.length, 0, bytesPerLengthMarker)

    bufs.push(len)
    bufs.push(part)
  }

  return Buffer.concat(bufs)
}

serialize.addrToTxMapping = ({ address, blockNumber, inbound, hash }) => {
  const parts = [
    address,
    blockNumber == null
      ? null
      : blockNumberToHex(blockNumber),
    inbound == null
      ? null
      : inbound ? TX_IN : TX_OUT,
    hash,
  ]

  return serialize.generic(parts, PART_LENGTH_BYTES)
}

unserialize.generic = (buf, bytesPerLengthMarker=DEFAULT_BYTES_PER_LENGTH) => {
  const parts = []
  const l = buf.length
  let idx = 0
  while (idx < l) {
    let dlen = readInt(buf, idx, bytesPerLengthMarker)
    idx += bytesPerLengthMarker
    let start = idx
    let end = start + dlen
    let part = buf.slice(start, end)
    parts.push(part)
    idx += part.length
  }

  return parts
}

unserialize.addrToTxMapping = buf => {
  const [address, blockNumber, inbound, hash] = unserialize.generic(buf, PART_LENGTH_BYTES)
  return {
    address: bufToHex(address),
    blockNumber: parseInt(blockNumber.toString('hex'), 16),
    inbound: bufToHex(inbound) === TX_IN,
    hash: bufToHex(hash),
  }
}

module.exports = {
  serialize,
  unserialize,
}
