/** 部署 devnet 测试 Token：每个 Token 在一笔原子交易中创建并完成初始增发。 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { MINT_SIZE, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createInitializeMint2Instruction, createAssociatedTokenAccountIdempotentInstruction, createMintToCheckedInstruction, getAssociatedTokenAddressSync, unpackMint, unpackAccount } from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createSignerFromKeypair, signerIdentity, percentAmount, publicKey, isSome, none } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { fromWeb3JsKeypair, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import { createV1, mplTokenMetadata, findMetadataPda, getMetadataAccountDataSerializer, TokenStandard, Key } from '@metaplex-foundation/mpl-token-metadata';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE = join(ROOT, 'config/devnet-mock.local/test-tokens');
const GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const METADATA = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const NAMES = ['kbtc', 'kdoge', 'keth', 'khype', 'klink', 'ksol', 'kusdc', 'kusdt', 'kweth'];
const DECIMALS: Record<string, number> = { kbtc: 8, kdoge: 8, keth: 8, khype: 8, klink: 8, ksol: 9, kusdc: 6, kusdt: 6, kweth: 8 };
type TxRecord = { operation: string; signature: string; status: string; blockhash: string; last_valid_block_height: number };
type TokenRecord = {
  [key: string]: unknown;
  status: string; cluster: string; genesis_hash: string; name: string; symbol: string;
  decimals: number; initial_supply: string; initial_supply_raw: string;
  administrator: string; token_program: string; mint: string | null;
  metadata_uri: string; image_uri: string; metadata_file: string; image_file: string;
  create_administrator_token_account: boolean;
  planned_authorities: { mint_authority: string; freeze_authority: null; metadata_update_authority: string };
  metadata_config: { program: string; standard: string; is_mutable: boolean; seller_fee_basis_points: number; creators: unknown[]; collection: null; uses: null };
  transactions: TxRecord[];
};
type Journal = { raw_transaction: string; signature: string; blockhash: string; last_valid_block_height: number };
function json<T>(path: string): T { return JSON.parse(readFileSync(path, 'utf8')) as T; }
function save(path: string, data: unknown, privateFile = false) {
  writeFileSync(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`, { mode: privateFile ? 0o600 : 0o644 });
  renameSync(`${path}.tmp`, path);
  if (privateFile) chmodSync(path, 0o600);
}
function cli(args: string[]) { return execFileSync('solana', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
let rpcUrl = '';

async function main() {
  const { values } = parseArgs({ options: {
    check: { type: 'boolean' }, deploy: { type: 'boolean' },
    'verify-only': { type: 'boolean' }, token: { type: 'string' },
  }});
  assert([values.check, values.deploy, values['verify-only']].filter(Boolean).length <= 1, '运行模式不能同时指定');
  const mode = values.deploy ? 'deploy' : values['verify-only'] ? 'verify' : 'check';
  const names = values.token ? [values.token.toLowerCase()] : NAMES;
  assert(names.every(name => NAMES.includes(name)), '未知 Token 名称');
  const config = cli(['config', 'get']);
  const field = (prefix: string) => {
    const value = config.split('\n').find(line => line.startsWith(prefix))?.slice(prefix.length).trim();
    assert(value, `CLI 配置缺少 ${prefix}`); return value;
  };
  rpcUrl = field('RPC URL:');
  const keypairPath = field('Keypair Path:').replace(/^~(?=\/)/, homedir());
  const secret = json<number[]>(keypairPath);
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));
  const walletAddress = wallet.publicKey.toBase58();
  assert.equal(cli(['address']), walletAddress, 'CLI 地址与密钥不一致');
  const connection = new Connection(rpcUrl, { commitment: 'confirmed', confirmTransactionInitialTimeout: 60_000 });
  assert.equal(await connection.getGenesisHash(), GENESIS, 'RPC 不是 devnet');
  const umi = createUmi(rpcUrl).use(mplTokenMetadata());
  umi.use(signerIdentity(createSignerFromKeypair(umi, fromWeb3JsKeypair(wallet))));
  const balanceBefore = await connection.getBalance(wallet.publicKey);
  const programs = await connection.getMultipleAccountsInfo([TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, METADATA]);
  assert(programs.every(account => account?.executable), '所需程序尚未部署到当前网络');

  // 在生成密钥或发送交易前检查全部配置。
  const tokens = names.map(name => {
    const path = join(ROOT, 'tokens', name, 'token.json');
    const record = json<TokenRecord>(path);
    assert.equal(record.cluster, 'devnet'); assert.equal(record.genesis_hash, GENESIS);
    assert.equal(record.symbol, name.toUpperCase()); assert.equal(record.name, name.toUpperCase());
    assert.equal(record.decimals, DECIMALS[name]);
    assert.equal(record.initial_supply, '1', '本部署流程要求初始供应量为 1');
    assert.equal(record.initial_supply_raw, (10n ** BigInt(record.decimals)).toString());
    assert.equal(record.token_program, TOKEN_PROGRAM_ID.toBase58());
    assert.equal(record.administrator, walletAddress);
    assert.deepEqual(record.planned_authorities, {
      mint_authority: walletAddress, freeze_authority: null, metadata_update_authority: walletAddress,
    });
    assert.equal(record.create_administrator_token_account, true);
    assert.deepEqual(record.metadata_config, { program: METADATA.toBase58(), standard: 'Fungible',
      is_mutable: true, seller_fee_basis_points: 0, creators: [], collection: null, uses: null });
    assert.equal(record.metadata_uri, `https://kgmx.jimao.uk/metadata/${name}.json`);
    assert.equal(record.image_uri, `https://kgmx.jimao.uk/image/${name}.svg`);
    assert.equal(record.metadata_file, `${name}.json`); assert.equal(record.image_file, `${name}.svg`);
    const metadata = json<{ name: string; symbol: string; image: string }>(join(dirname(path), record.metadata_file));
    assert.equal(metadata.name, record.name); assert.equal(metadata.symbol, record.symbol); assert.equal(metadata.image, record.image_uri);
    assert(existsSync(join(dirname(path), record.image_file)));
    assert(Array.isArray(record.transactions));
    return { name, path, record };
  });
  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  // 包括 metadata 租金、协议创建费用、ATA 租金和交易费用的保守预算。
  const requiredBalance = mode === 'deploy' ? names.length * 50_000_000 : 0;
  assert(balanceBefore >= requiredBalance, '钱包余额不足：每个 Token 预留 0.05 SOL');
  console.log(`网络：devnet；钱包：${walletAddress}；模式：${mode}；Token 数量：${names.length}`);
  let locked = false;
  const lock = join(PRIVATE, 'deploy.lock');
  if (mode === 'deploy') {
    mkdirSync(PRIVATE, { recursive: true, mode: 0o700 }); chmodSync(PRIVATE, 0o700);
    mkdirSync(lock); locked = true;
    writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
  }
  try {
    for (const { name, path, record } of tokens) {
      const keyPath = join(PRIVATE, `${name}-mint-keypair.json`);
      const journalPath = join(PRIVATE, `${name}-transaction.json`);
      let mintKey: Keypair | undefined;
      if (existsSync(keyPath)) mintKey = Keypair.fromSecretKey(Uint8Array.from(json<number[]>(keyPath)));
      if (record.mint && mintKey) assert.equal(record.mint, mintKey.publicKey.toBase58(), `${name} mint 密钥不匹配`);
      if (!record.mint && !mintKey) {
        if (mode === 'verify') throw new Error(`${name} 尚未准备 mint`);
        mintKey = Keypair.generate();
        if (mode === 'deploy') save(keyPath, Array.from(mintKey.secretKey), true);
      }
      const mint = record.mint ? new PublicKey(record.mint) : mintKey!.publicKey;
      const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const metadata = new PublicKey(findMetadataPda(umi, { mint: publicKey(mint.toBase58()) })[0]);
      const existing = await connection.getAccountInfo(mint);
      if (!existing && mode === 'verify') throw new Error(`${name} 链上 mint 不存在`);
      if (!existing) {
        assert(mintKey, `${name} 缺少持久保存的 mint 密钥，拒绝创建其他身份`);
        let journal = existsSync(journalPath) ? json<Journal>(journalPath) : undefined;
        if (journal) {
          const status = (await connection.getSignatureStatuses([journal.signature], { searchTransactionHistory: true })).value[0];
          if (status?.err) throw new Error(`${name} 先前交易失败：${JSON.stringify(status.err)}；请检查后再恢复`);
          if (status) throw new Error(`${name} 先前交易已出现但 mint 尚不可读，请稍后重试`);
          const height = await connection.getBlockHeight('finalized');
          // 未过期时重发同一笔已签名交易，避免更换 blockhash 造成重复增发。
          if (height > journal.last_valid_block_height) journal = undefined;
        }
        if (!journal) {
          const latest = await connection.getLatestBlockhash();
          const tx = new Transaction({ feePayer: wallet.publicKey, ...latest });
          const metadataInstructions = createV1(umi, {
            mint: publicKey(mint.toBase58()), name: record.name, symbol: record.symbol,
            uri: record.metadata_uri, sellerFeeBasisPoints: percentAmount(0),
            tokenStandard: TokenStandard.Fungible, isMutable: true, creators: none(),
            decimals: record.decimals, splTokenProgram: publicKey(TOKEN_PROGRAM_ID.toBase58()),
          }).getInstructions().map(toWeb3JsInstruction);
          tx.add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
            SystemProgram.createAccount({ fromPubkey: wallet.publicKey, newAccountPubkey: mint,
              lamports: mintRent, space: MINT_SIZE, programId: TOKEN_PROGRAM_ID }),
            createInitializeMint2Instruction(mint, record.decimals, wallet.publicKey, null),
            ...metadataInstructions,
            createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, ata, wallet.publicKey, mint),
            createMintToCheckedInstruction(mint, ata, wallet.publicKey, BigInt(record.initial_supply_raw), record.decimals),
          );
          tx.sign(wallet, mintKey);
          const raw = tx.serialize(); // 同时检查交易大小和全部签名。
          assert(raw.length <= 1232, `${name} 交易超过大小限制`);
          journal = { raw_transaction: raw.toString('base64'), signature: base58.deserialize(tx.signature!)[0],
            blockhash: latest.blockhash, last_valid_block_height: latest.lastValidBlockHeight };
          console.log(`${record.symbol}：交易大小 ${raw.length} bytes，初始增发 ${record.initial_supply}`);
        }
        if (mode === 'check') { console.log(`${record.symbol}：配置及交易构建检查通过（未发送）`); continue; }
        assert.equal(mode, 'deploy');
        record.mint = mint.toBase58(); record.status = 'deploying';
        record.mint_keypair_file = `config/devnet-mock.local/test-tokens/${name}-mint-keypair.json`;
        record.metadata_account = metadata.toBase58(); record.administrator_token_account = ata.toBase58();
        if (!record.transactions.some(tx => tx.signature === journal!.signature)) {
          record.transactions.push({ operation: 'create_mint_metadata_ata_and_initial_supply', status: 'prepared',
            signature: journal.signature, blockhash: journal.blockhash, last_valid_block_height: journal.last_valid_block_height });
        }
        // 发送前持久保存已签名交易和身份；任何一步中断均可恢复。
        save(journalPath, journal, true); save(path, record);
        const signature = await connection.sendRawTransaction(Buffer.from(journal.raw_transaction, 'base64'), {
          skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 5,
        });
        assert.equal(signature, journal.signature);
        const confirmed = await connection.confirmTransaction({ signature, blockhash: journal.blockhash,
          lastValidBlockHeight: journal.last_valid_block_height }, 'confirmed');
        assert.equal(confirmed.value.err, null, `交易失败：${JSON.stringify(confirmed.value.err)}`);
        const entry = record.transactions.find(tx => tx.signature === signature)!; entry.status = 'confirmed';
        save(path, record);
        console.log(`${record.symbol}：交易已确认 ${signature}`);
      }
      // 三个账户在同一笔交易中创建；已有 mint 只检查，永不追加初始增发。
      const state = await connection.getMultipleAccountsInfoAndContext([mint, ata, metadata]);
      const [mintInfo, ataInfo, metadataInfo] = state.value;
      assert(mintInfo && ataInfo && metadataInfo, `${name} 缺少 mint、ATA 或 metadata`);
      const mintState = unpackMint(mint, mintInfo);
      const tokenState = unpackAccount(ata, ataInfo);
      assert(mintState.isInitialized); assert.equal(mintState.decimals, record.decimals);
      assert.equal(mintState.mintAuthority?.toBase58(), walletAddress); assert.equal(mintState.freezeAuthority, null);
      assert.equal(mintState.supply.toString(), record.initial_supply_raw, `${name} 供应量与初始配置不一致`);
      assert.equal(tokenState.owner.toBase58(), walletAddress); assert.equal(tokenState.mint.toBase58(), mint.toBase58());
      assert.equal(tokenState.amount.toString(), record.initial_supply_raw); assert(!tokenState.isFrozen);
      assert.equal(metadataInfo.owner.toBase58(), METADATA.toBase58());
      const [meta] = getMetadataAccountDataSerializer().deserialize(metadataInfo.data);
      const clean = (s: string) => s.replace(/\0+$/g, '');
      assert.equal(meta.key, Key.MetadataV1); assert.equal(meta.mint, mint.toBase58());
      assert.equal(meta.updateAuthority, walletAddress); assert.equal(clean(meta.name), record.name);
      assert.equal(clean(meta.symbol), record.symbol); assert.equal(clean(meta.uri), record.metadata_uri);
      assert(meta.isMutable); assert.equal(meta.sellerFeeBasisPoints, 0);
      assert(isSome(meta.tokenStandard) && meta.tokenStandard.value === TokenStandard.Fungible);
      assert(!isSome(meta.creators) || meta.creators.value.length === 0, `${name} creators 与配置不一致`);
      assert(!isSome(meta.collection) && !isSome(meta.uses));
      if (mode === 'deploy') {
        record.status = 'deployed'; record.mint = mint.toBase58(); record.mint_authority = walletAddress;
        record.freeze_authority = null; record.metadata_account = metadata.toBase58();
        record.metadata_update_authority = walletAddress; record.administrator_token_account = ata.toBase58();
        if (existsSync(journalPath)) {
          const journal = json<Journal>(journalPath);
          const entry = record.transactions.find(tx => tx.signature === journal.signature);
          if (entry) entry.status = 'confirmed';
        }
        record.verified_at = new Date().toISOString(); record.verified_slot = state.context.slot;
        record.verified_supply_raw = mintState.supply.toString();
        record.verified_administrator_balance_raw = tokenState.amount.toString();
        save(path, record);
      }
      console.log(`${record.symbol}：链上核对通过；mint=${mint.toBase58()}；供应量=1；管理员余额=1`);
    }
    const balanceAfter = await connection.getBalance(wallet.publicKey);
    console.log(`完成：${names.length} 个 Token；本次钱包支出 ${(balanceBefore - balanceAfter) / 1e9} SOL`);
  } finally {
    if (locked) rmSync(lock, { recursive: true });
  }
}
main().catch(error => {
  // RPC URL 可能含 API key，错误输出中也必须隐藏。
  let message = error instanceof Error ? error.message : String(error);
  if (rpcUrl) message = message.split(rpcUrl).join('<configured RPC>');
  console.error(`失败：${message}`);
  process.exitCode = 1;
});
