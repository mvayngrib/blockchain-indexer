CHAIN="$1"
docker run -ti \
  -p 8180:8180 \
  -p 8545:8545 \
  -p 8546:8546 \
  -p 30303:30303 \
  -p 30303:30303/udp \
  -v ~/.parity/share/io.parity.ethereum/docker/:/root/.local/share/io.parity.ethereum/ \
  parity/parity:v1.7.0 \
  --chain "$CHAIN" \
  --ui-interface all \
  --jsonrpc-interface all
#  --no-ui --no-dapps --no-discovery
