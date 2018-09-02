# blockchain-indexer

indexer for ethereum blockchain to map addrs -> txs

## Usage

### cli

create a `conf.json` file (see [./conf-sample.js](./conf-sample.js))

```sh
blockchain-indexer
```

### module

```js
const createBIndexer = require('blockchain-indexer')
const components = createBIndexer({
  network: 'main',
  dir: './',
  nodeHTTPPort: 8545,
  nodeWSPort: 8546,
  // port to run HTTP server on
  port: 3000,
  // how many blocks to wait for, before processing
  blocksPerBatch: 100,
  startBlock: 203700,
  // blocks below this height will not be processed
  confirmationHeight: 15,
  storage: 'leveldb'
  // alternatively with redis:
  // storage: 'redis',
  // redis: {
  //   port: 6379
  // }
})

// in case you need to use the individual components:
const { 
  server, 
  api, 
  indexer, 
  processor, 
  state, 
  storage,
} = components
```

### API

#### /tx/:hash

get a transaction by its hash

```sh
curl localhost:3000/tx/:hash

# same as eth_getTransactionByHash

```

#### /address/:hash

get an addresses transactions by its hash

```sh
curl localhost:3000/address/:hash

# {"txs":[{ "blockNumber": number, "hash": string, "inbound": boolean }]}
```
#### /height

get processed chain height

```sh
curl localhost:3000/height

# 1038402
```
