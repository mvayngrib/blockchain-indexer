
## ethereum node

[Various Charts & Stats](https://etherscan.io/charts)
  - [geth fast sync chain data size](https://etherscan.io/chart2/chaindatasizefast)
  - [transaction fees](https://etherscan.io/chart/transactionfee)
  - [gas price](https://etherscan.io/chart/gasprice)
  - [address growth](https://etherscan.io/chart/address)
  - [block size](https://etherscan.io/chart/blocksize)

read this and weep (all on same thread):
- https://github.com/ethereum/go-ethereum/issues/16218#issuecomment-371454280
- https://github.com/ethereum/go-ethereum/issues/16218#issuecomment-380021850
- https://github.com/ethereum/go-ethereum/issues/16218#issuecomment-380023338

### parity

#### warp sync

"These snapshots can be used to quickly get a full copy of the state at a given block. Every 30,000 blocks, nodes will take a consensus-critical snapshot of that block's state. Any node can fetch these snapshots over the network, enabling a fast sync."

however, warp sync seems to have issues:
- https://github.com/paritytech/parity-ethereum/issues/7436
- https://github.com/paritytech/parity-ethereum/issues/6372

#### non-warp sync

can take a couple of days to sync

### geth

#### fast mode
- download blocks + txs in parallel, validate a bit later

Tips:
```
Make sure your port to Geth client is opened

It’s really important to make sure that the connection to your Geth client is not limited. One huge headache I encountered was to let my firewall limit the number of connections I could have through the Geth client.

You can spot this problem by looking at the peers count. If it stays consistently low at about 1–3 peers (for at least half an hour), there is a good chance your connection is limited. A healthy range is above 5 peers.""
```

### sync tips

run first sync quickly with a powerful machine, dump the chain data, pick up with a less powerful one

## the indexer

besides various calls supported by ethereum nodes natively via JSON-RPC, Tradle needs an additional `listTransactions` call to get a list of txs from/to a given address

this module implements an index for address -> txs
