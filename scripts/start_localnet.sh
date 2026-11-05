#!/bin/bash

export ADDRESS=$(solana-keygen pubkey)

export PLUGIN_MESSENGER_CONFIG='{messenger_type="Redis",connection_config={redis_connection_str="redis://localhost:6379"}}'
RUST_LOG=trace \
  solana-test-validator -r \
  -l test-ledger \
  --url mainnet-beta \
  --geyser-plugin-config scripts/resources/geyser/plugin_config.json \
  --limit-ledger-size 1000000000 \
  --log-messages-bytes-limit 1000000000 \
  --compute-unit-limit 1000000000 \
  --clone C7RmcKdjeFscYSyekkmCjvHcnBQd7qJDkeB9RmRtuB3L \
  --clone DaWUKXCyXsnzcvLUyeJRWou8KTn7XtadgTsdhJ6RHS7b \
  --upgradeable-program rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ external-programs/pyth-receiver.so $ADDRESS \
  --upgradeable-program pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT external-programs/pyth-push-oracle.so $ADDRESS \
  --upgradeable-program HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ external-programs/wormhole.so $ADDRESS \
  --upgradeable-program 14tZjpdcT58u8UUe7CXKK6NRRFi4Bhkvo6bBDJYmT8Jt target/verifiable/gmsol_store.so $ADDRESS \
  --upgradeable-program G9DMZS9KHir3AsYKMV3T3H7siwabw5RPYBU6jXTHd3WS target/verifiable/gmsol_treasury.so $ADDRESS \
  --upgradeable-program H952HpN1HP8vjz4FLqbZSYXn7B86WL9cRGzxj9dWs4sU target/verifiable/gmsol_timelock.so $ADDRESS \
  --upgradeable-program 4r2gEz7YfN9nWWpC3DQPSSKfHARAf5QaCp5GJWQGEift target/verifiable/gmsol_mock_chainlink_verifier.so $ADDRESS \
  $@
