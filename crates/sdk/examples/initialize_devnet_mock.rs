//! Initialize the personal devnet Store, wallet roles and mock verifier.
//! Run: cargo run -p gmsol-sdk --example initialize_devnet_mock --features client,devnet --locked
use std::{path::Path, process::Command, sync::Arc};

use eyre::{ensure, eyre, Result};
use gmsol_sdk::{
    ops::{RoleOps, StoreOps},
    Client,
};
use gmsol_solana_utils::cluster::Cluster;
use serde_json::{json, Value};
use solana_sdk::{
    hash::hash,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{read_keypair_file, NullSigner, Signer},
    system_program,
    transaction::Transaction,
};

const MANIFEST: &str = "config/devnet-mock-deployment.json";
const RECORD: &str = "config/devnet-mock-initialization.json";
// The standard CLI init-roles set, plus the restricted market configuration role.
// Migration is deliberately excluded: this deployment does not enable migration.
const ROLES: &[&str] = &[
    "RESTART_ADMIN",
    "GT_CONTROLLER",
    "MARKET_KEEPER",
    "ORDER_KEEPER",
    "PRICE_KEEPER",
    "FEATURE_KEEPER",
    "CONFIG_KEEPER",
    "MARKET_CONFIG_KEEPER",
    "ORACLE_CONTROLLER",
    "TREASURY_OWNER",
    "TREASURY_ADMIN",
    "TREASURY_WITHDRAWER",
    "TREASURY_KEEPER",
    "TIMELOCK_ADMIN",
    "TIMELOCK_KEEPER",
    "__TLD_ADMIN",
];

fn command(args: &[&str]) -> Result<String> {
    let output = Command::new("solana").args(args).output()?;
    ensure!(output.status.success(), "Solana CLI command failed");
    Ok(String::from_utf8(output.stdout)?.trim().to_owned())
}

fn save(record: &Value) -> Result<()> {
    let temporary = format!("{RECORD}.tmp");
    std::fs::write(
        &temporary,
        format!("{}\n", serde_json::to_string_pretty(record)?),
    )?;
    std::fs::rename(temporary, RECORD)?;
    Ok(())
}

fn record_tx(record: &mut Value, operation: &str, signature: impl ToString) -> Result<()> {
    let signature = signature.to_string();
    println!("{operation}: {signature}");
    record["transactions"].as_array_mut().unwrap().push(json!({
        "operation": operation, "signature": signature,
    }));
    save(record)
}

fn check_mock(
    account: &solana_sdk::account::Account,
    program: &Pubkey,
    name: &str,
    fields: &[Pubkey],
) -> Result<()> {
    ensure!(account.owner == *program, "Unexpected {name} owner");
    let discriminator = hash(format!("account:{name}").as_bytes());
    ensure!(
        account.data.get(..8) == Some(&discriminator.as_ref()[..8]),
        "Unexpected {name} discriminator"
    );
    for (i, field) in fields.iter().enumerate() {
        ensure!(
            account.data.get(8 + i * 32..40 + i * 32) == Some(field.as_ref()),
            "Unexpected {name} field {i}; refusing to overwrite existing setup"
        );
    }
    Ok(())
}

async fn initialize(rpc_url: &str, keypair: &str) -> Result<()> {
    let manifest: Value = serde_json::from_str(&std::fs::read_to_string(MANIFEST)?)?;
    let payer = Arc::new(read_keypair_file(keypair).map_err(|_| eyre!("Cannot read CLI keypair"))?);
    let wallet = payer.pubkey();
    ensure!(
        wallet.to_string() == command(&["address"])?,
        "CLI wallet mismatch"
    );
    ensure!(
        Some(wallet.to_string().as_str()) == manifest["upgrade_authority"].as_str(),
        "Wallet differs from deployment authority"
    );
    let client = Client::new(rpc_url.parse::<Cluster>()?, payer.clone())?;
    ensure!(
        client.rpc().get_genesis_hash().await?.to_string() == manifest["genesis_hash"],
        "Configured RPC is not the recorded devnet"
    );
    ensure!(
        Some(client.store_program_id().to_string().as_str())
            == manifest["programs"]["gmsol_store"]["program_id"].as_str(),
        "Store program ID mismatch"
    );
    let store = client.find_store_address("");
    ensure!(
        Some(store.to_string().as_str()) == manifest["default_store_pda"].as_str(),
        "Store PDA mismatch"
    );
    let mock: Pubkey = manifest["programs"]["gmsol_mock_chainlink_verifier"]["program_id"]
        .as_str()
        .ok_or_else(|| eyre!("Missing mock program ID"))?
        .parse()?;
    for id in [*client.store_program_id(), mock] {
        ensure!(
            client.rpc().get_account(&id).await?.executable,
            "Program {id} is not executable"
        );
    }
    let verifier = Pubkey::find_program_address(&[b"verifier"], &mock).0;
    let access = Pubkey::find_program_address(&[b"access_controller"], &mock).0;
    let accounts = client
        .rpc()
        .get_multiple_accounts(&[store, verifier, access])
        .await?;
    if accounts[0].is_some() {
        let existing = client.store(&store).await?;
        ensure!(
            existing.authority == wallet
                && existing.treasury.receiver == wallet
                && existing.address.holding == wallet,
            "Existing Store wallet settings differ"
        );
    }
    ensure!(
        accounts[1].is_some() == accounts[2].is_some(),
        "Partial mock initialization"
    );
    if let (Some(v), Some(a)) = (&accounts[1], &accounts[2]) {
        check_mock(v, &mock, "VerifierAccount", &[wallet, access])?;
        check_mock(a, &mock, "AccessController", &[store])?;
    }
    let mut record = if Path::new(RECORD).exists() {
        let previous: Value = serde_json::from_str(&std::fs::read_to_string(RECORD)?)?;
        ensure!(
            previous["wallet"] == wallet.to_string() && previous["store"] == store.to_string(),
            "Initialization record identity mismatch"
        );
        previous
    } else {
        json!({"cluster": "devnet", "wallet": wallet.to_string(), "store": store.to_string(),
            "store_key": "", "mock_program": mock.to_string(), "verifier": verifier.to_string(),
            "access_controller": access.to_string(), "access_controller_user": store.to_string(),
            "roles": ROLES, "transactions": [], "verified": false})
    };
    record["verified"] = json!(false);
    save(&record)?;
    println!("Wallet: {wallet}\nStore: {store}\nMock access controller: {access}");
    if accounts[0].is_none() {
        let sig = client
            .initialize_store::<NullSigner>("", None, None, None)
            .send()
            .await?;
        record_tx(&mut record, "initialize_store", sig)?;
    }
    for role in ROLES {
        let current = client.store(&store).await?;
        if !current
            .role
            .roles
            .get(*role)
            .is_some_and(|metadata| metadata.is_enabled())
        {
            let sig = client.enable_role(&store, role).send().await?;
            record_tx(&mut record, &format!("enable_role:{role}"), sig)?;
        }
        let current = client.store(&store).await?;
        if !current.role.has_role(&wallet, role).unwrap_or(false) {
            let sig = client.grant_role(&store, &wallet, role).send().await?;
            record_tx(&mut record, &format!("grant_role:{role}"), sig)?;
        }
    }
    if accounts[1].is_none() {
        // Anchor discriminator + Borsh Pubkey, matching the deployed mock IDL.
        let mut data = hash(b"global:initialize").as_ref()[..8].to_vec();
        data.extend_from_slice(store.as_ref());
        let ix = Instruction {
            program_id: mock,
            data,
            accounts: vec![
                AccountMeta::new(wallet, true),
                AccountMeta::new(verifier, false),
                AccountMeta::new(access, false),
                AccountMeta::new_readonly(system_program::ID, false),
            ],
        };
        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&wallet),
            &[payer.as_ref()],
            client.rpc().get_latest_blockhash().await?,
        );
        let sig = client.rpc().send_and_confirm_transaction(&tx).await?;
        record_tx(&mut record, "initialize_mock_verifier", sig)?;
    }
    let current = client.store(&store).await?;
    ensure!(
        current.authority == wallet
            && current.treasury.receiver == wallet
            && current.address.holding == wallet,
        "Store authority verification failed"
    );
    for role in ROLES {
        ensure!(
            current.role.has_role(&wallet, role)?,
            "Missing wallet role: {role}"
        );
    }
    check_mock(
        &client.rpc().get_account(&verifier).await?,
        &mock,
        "VerifierAccount",
        &[wallet, access],
    )?;
    check_mock(
        &client.rpc().get_account(&access).await?,
        &mock,
        "AccessController",
        &[store],
    )?;
    record["verified"] = json!(true);
    record["verified_slot"] = json!(client.rpc().get_slot().await?);
    record["authority"] = json!(wallet.to_string());
    record["receiver"] = json!(wallet.to_string());
    record["holding"] = json!(wallet.to_string());
    save(&record)?;
    println!(
        "Verified Store, all {} wallet roles and mock access control. Record: {RECORD}",
        ROLES.len()
    );
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    // Capture CLI config without printing its credential-bearing RPC URL.
    let config = command(&["config", "get"])?;
    let field = |label: &str| {
        config
            .lines()
            .find_map(|line| line.strip_prefix(label))
            .map(str::trim)
            .ok_or_else(|| eyre!("Missing CLI config field: {label}"))
    };
    let rpc_url = field("RPC URL:")?;
    let keypair = field("Keypair Path:")?;
    initialize(rpc_url, keypair).await.map_err(|err| {
        eyre!(
            "{}",
            format!("{err:?}").replace(rpc_url, "<configured RPC>")
        )
    })
}
