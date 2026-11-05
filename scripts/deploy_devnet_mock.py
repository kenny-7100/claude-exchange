#!/usr/bin/env python3
"""Deploy the programs in config/devnet-mock-deployment.json and verify their bytes."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "config/devnet-mock-deployment.json"


def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(manifest):
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    options = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    # The configured RPC can contain credentials; never print its URL.
    if run("solana", "genesis-hash") != manifest["genesis_hash"]:
        raise RuntimeError("Configured Solana RPC is not devnet")
    authority = run("solana", "address")
    if authority != manifest["upgrade_authority"]:
        raise RuntimeError("Configured wallet differs from the recorded upgrade authority")

    private = ROOT / "config/devnet-mock.local"
    private.mkdir(exist_ok=True, mode=0o700)
    names = ["gmsol_mock_chainlink_verifier"] + [
        name for name in manifest["programs"] if name != "gmsol_mock_chainlink_verifier"
    ]
    # Check every local identity and artifact before sending any transaction.
    for name in names:
        entry = manifest["programs"][name]
        binary = ROOT / "target/deploy" / f"{name}.so"
        if not binary.is_file():
            raise RuntimeError(f"Missing binary: {binary}")
        if run("solana-keygen", "pubkey", str(ROOT / entry["keypair"])) != entry["program_id"]:
            raise RuntimeError(f"Program keypair mismatch: {name}")
        source = ROOT / "programs" / name.removeprefix("gmsol_").replace("_", "-") / "src/lib.rs"
        if f'declare_id!("{entry["program_id"]}")' not in source.read_text():
            raise RuntimeError(f"Source program address mismatch: {name}")
        # An IDL is not required by the loader. Check every available local IDL,
        # including the SDK interface used for cross-program calls.
        for directory in ("target/idl", "crates/programs/idls"):
            path = ROOT / directory / f"{name}.json"
            if path.exists() and json.loads(path.read_text())["address"] != entry["program_id"]:
                raise RuntimeError(f"IDL address mismatch: {path}")

    for name in names:
        entry = manifest["programs"][name]
        binary = ROOT / "target/deploy" / f"{name}.so"
        expected_hash = digest(binary)
        if not options.verify_only and entry.get("sha256") != expected_hash:
            buffer = private / f"{name}-buffer-keypair.json"
            if not buffer.exists():
                subprocess.run(
                    ["solana-keygen", "new", "--no-bip39-passphrase", "--silent", "--outfile", str(buffer)],
                    cwd=ROOT, check=True, stdout=subprocess.DEVNULL,
                )
                buffer.chmod(0o600)
            print(f"Deploying {name}: {entry['program_id']}", flush=True)
            log = private / f"{name}-deploy.log"
            # Persist the buffer signer to make interrupted uploads resumable and
            # avoid the CLI printing a generated buffer's recovery phrase.
            with log.open("w") as output:
                result = subprocess.run(
                    ["solana", "program", "deploy", str(binary),
                     "--program-id", str(ROOT / entry["keypair"]),
                     "--buffer", str(buffer), "--use-rpc", "--max-sign-attempts", "10",
                     "--output", "json"],
                    cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
                )
            if result.returncode:
                raise RuntimeError(f"Deployment failed for {name}; inspect {log}")
            # Save the transaction result before subsequent RPC verification.
            entry["deploy_result"] = json.loads(log.read_text())
            save(manifest)

        info = json.loads(run("solana", "program", "show", entry["program_id"], "--output", "json"))
        if info["authority"] != authority:
            raise RuntimeError(f"Upgrade authority mismatch: {name}")
        dumped = private / f"{name}-onchain.so"
        run("solana", "program", "dump", entry["program_id"], str(dumped))
        actual = dumped.read_bytes()
        expected = binary.read_bytes()
        # ProgramData may reserve additional zero-filled capacity.
        if actual[:len(expected)] != expected or any(actual[len(expected):]):
            raise RuntimeError(f"On-chain binary mismatch: {name}")
        entry.update({
            "sha256": expected_hash,
            "binary_bytes": len(expected),
            "programdata_address": info["programdataAddress"],
            "last_deploy_slot": info["lastDeploySlot"],
            "verified_at": datetime.now(timezone.utc).isoformat(),
        })
        save(manifest)
        print(f"Verified {name}: slot {info['lastDeploySlot']}, SHA-256 {expected_hash}", flush=True)


if __name__ == "__main__":
    main()
