# Independent devnet deployment with mock oracle support

This checkout uses its own eight program IDs. The IDs are synchronized across
program declarations, callback checks, Anchor configuration, and SDK IDLs.
`config/devnet-mock-deployment.json` records public deployment information,
binary hashes, transaction results, and verification slots.

## Build

```sh
just build-devnet-mock
```

SBF builds enable `devnet,mock`, using platform-tools v1.56 and architecture v0.
The local SBF builder must support those options (the installed builder is 4.4.0).
Anchor is 0.31.1 and the Solana CLI is 2.1.21. IDL generation uses Anchor's nightly
host toolchain; the successful installed nightly is Rust 1.101.0-nightly
(92b5b8c87 2026-10-29). The `test-only` and `migration` features are not enabled.

SBF files are generated under `target/deploy/`; all eight IDLs are generated under
`target/idl/`, and the six SDK IDLs are synchronized into `crates/programs/idls/`.

## Deploy and inspect

Configure the Solana CLI to use a devnet RPC and the wallet whose public key is
the manifest's `upgrade_authority`, then run:

```sh
just deploy-devnet-mock
just verify-devnet-mock
```

The deploy script checks the devnet genesis hash, wallet, program keypairs, and
IDL addresses before sending transactions. It deploys the mock verifier first,
retains the wallet as upgrade authority, and downloads each deployed binary to
compare its bytes with the local artifact. Successfully verified, unchanged
artifacts are checked again without redeploying them. Upload buffer keypairs are
persisted so an interrupted upload can be resumed.

Program and buffer keypairs are stored in **`config/devnet-mock.local/`**, which
is ignored by Git. Back up that directory securely; it is deliberately outside
`target/` so `cargo clean` does not delete deployment identities. Deployment logs
and downloaded binaries are also stored there. Do not commit its contents.
After a clean, restore the program keypairs into `target/deploy/` before using
Anchor's own deploy/keys commands; the deployment script uses the persistent
copies directly.

## Initialize Store and mock access control

With the same devnet RPC and Solana CLI wallet used for deployment, run:

```sh
just initialize-devnet-mock
```

The SDK example reads the configured Solana CLI RPC and keypair, checks the
devnet genesis hash and deployment authority, and initializes the default Store.
Its authority, receiver and holding addresses are all the CLI wallet. For this
personal learning instance, all 16 roles in the initialization record are
enabled and granted to that wallet, including keepers, configuration, Treasury
and Timelock roles. Migration is excluded. Granting a role does not initialize
Treasury or Timelock business accounts.

The mock verifier authority is also the CLI wallet. Its access controller's
permitted `user` is the **Store PDA**, because Store signs the verifier CPI.
This binding is required even though the wallet holds the keeper permissions.
The verifier and access-controller PDAs are singleton accounts for this mock
program; an existing conflicting binding causes initialization to stop.

Public addresses, successful transaction signatures and the verification slot
are saved to `config/devnet-mock-initialization.json`. Progress is saved after
each confirmed transaction. Rerunning the command reads chain state, skips
existing matching initialization and grants, and verifies the resulting state.
The SDK example requires the `client,devnet` features; it does not rebuild or
redeploy any on-chain program.

## Remaining scope

Markets, tokens, token maps, oracle/price-feed accounts and other business
accounts are not initialized. No mock price reports or trading transactions
are submitted. GT Incentive remains the existing initialization-only program.

The default Store PDA for this instance is also recorded in the deployment manifest.
Mock prices use the `ChainlinkDataStreams` provider and still require the
appropriate keeper/authority, matching feed IDs, valid ranges, and fresh
timestamps. Store compiled with `mock` also continues to accept the real
Chainlink verifier. A mock report generation/posting tool remains future work.

IDL files are generated locally by this workflow. Publishing them to on-chain
IDL accounts is a separate step.
