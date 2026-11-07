import { BorshAccountsCoder, BorshInstructionCoder, type Idl } from '@coral-xyz/anchor'
import { Buffer } from 'buffer'
import { compress } from 'snappyjs'
import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY, SystemProgram, Transaction, TransactionInstruction, type AccountInfo } from '@solana/web3.js'
import deployment from '../../../config/devnet-mock-deployment.json' with { type: 'json' }
import initialization from '../../../config/devnet-mock-initialization.json' with { type: 'json' }
import feedConfig from '../../../config/devnet-mock-price-feeds.json' with { type: 'json' }
import storeIdl from './idl/mock-store.json' with { type: 'json' }

const idl = storeIdl as Idl
const accountsCoder = new BorshAccountsCoder(idl)
const instructionCoder = new BorshInstructionCoder(idl)
export const mockAuthority = new PublicKey(initialization.authority)
export const storeAddress = new PublicKey(initialization.store)
export const storeProgram = new PublicKey(deployment.programs.gmsol_store.program_id)
const mockProgram = new PublicKey(deployment.programs.gmsol_mock_chainlink_verifier.program_id)
export const refreshHintSeconds = feedConfig.refresh_hint_seconds
const entries: Record<string, { feed_id_hex: string }> = feedConfig.feeds

export type MockPrice = { exists: boolean; price: string | null; timestamp: number; address: string }
type FeedAccount = {
  provider: number; index: number; store: PublicKey; authority: PublicKey; token: PublicKey; feed_id: PublicKey
  price: { decimals: number; ts: { toString(): string }; price: { toString(): string } }
}
type StoreAccount = {
  role: {
    roles: { count: number; data: { value: { name: number[]; enabled: number; index: number } }[] }
    members: { count: number; data: { key: number[]; value: number }[] }
  }
}

export function mockFeed(mint: string) {
  const entry = entries[mint]
  if (!entry) throw new Error('该 Token 没有配置 Mock 报价来源。')
  const token = new PublicKey(mint)
  const index = Buffer.alloc(2)
  index.writeUInt16LE(feedConfig.index)
  const address = PublicKey.findProgramAddressSync([
    Buffer.from('price_feed'), storeAddress.toBuffer(), mockAuthority.toBuffer(),
    index, Buffer.from([feedConfig.provider]), token.toBuffer(),
  ], storeProgram)[0]
  return { address, feedId: new PublicKey(Buffer.from(entry.feed_id_hex, 'hex')), token }
}

export function decimalAmount(raw: bigint, decimals: number) {
  const digits = raw.toString().padStart(decimals + 1, '0')
  if (!decimals) return digits
  const fraction = digits.slice(-decimals).replace(/0+$/, '')
  return digits.slice(0, -decimals) + (fraction ? `.${fraction}` : '')
}

export function parseMockPrice(input: string): bigint {
  const value = input.trim()
  if (!/^\d+(\.\d{0,18})?$/.test(value) || value.length > 80) throw new Error('请输入大于 0 的 USD 价格，最多支持 18 位小数。')
  const [whole, fraction = ''] = value.split('.')
  const raw = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
  if (raw <= 0n || raw > (1n << 128n) - 1n) throw new Error('价格必须大于 0，且不能超出合约支持的范围。')
  return raw
}

export function decodeMockPrice(mint: string, account: AccountInfo<Buffer> | null): MockPrice {
  const { address, token, feedId } = mockFeed(mint)
  const base = { address: address.toBase58(), exists: !!account, price: null, timestamp: 0 }
  if (!account) return base
  if (!account.owner.equals(storeProgram)) throw new Error('Mock 报价账户的所属程序不正确。')
  const feed = accountsCoder.decode<FeedAccount>('PriceFeed', account.data)
  if (!feed.store.equals(storeAddress) || !feed.authority.equals(mockAuthority) || !feed.token.equals(token)
    || !feed.feed_id.equals(feedId) || feed.provider !== feedConfig.provider || feed.index !== feedConfig.index) {
    throw new Error('Mock 报价账户与固定数据源配置不一致。')
  }
  const timestamp = Number(feed.price.ts.toString())
  const raw = BigInt(feed.price.price.toString())
  return { ...base, timestamp, price: timestamp > 0 && raw > 0n ? decimalAmount(raw, feed.price.decimals) : null }
}

export async function readMockPrices(connection: Connection, mints: string[]) {
  const genesis = await connection.getGenesisHash()
  if (genesis !== deployment.genesis_hash) throw new Error('当前 RPC 不是 devnet，无法读取本项目的 Mock 报价。')
  const accounts = await connection.getMultipleAccountsInfo(mints.map((mint) => mockFeed(mint).address), 'confirmed')
  return Object.fromEntries(mints.map((mint, index) => [mint, decodeMockPrice(mint, accounts[index])]))
}

export function hasPriceKeeper(account: AccountInfo<Buffer>) {
  if (!account.owner.equals(storeProgram)) throw new Error('Store 所属程序不正确。')
  const store = accountsCoder.decode<StoreAccount>('Store', account.data)
  const roles = store.role.roles
  const members = store.role.members
  const role = roles.data.slice(0, roles.count).find(({ value }) => Buffer.from(value.name).toString().replace(/\0.*$/, '') === 'PRICE_KEEPER')?.value
  const member = members.data.slice(0, members.count).find(({ key }) => new PublicKey(key).equals(mockAuthority))
  return !!role && role.enabled === 255 && !!member && ((member.value >>> role.index) & 1) === 1
}

// Chainlink V3 为 9 个 ABI word；价格使用 18 位小数，bid、ask 与单价一致。
function word(value: bigint | number) {
  return Buffer.from(BigInt(value).toString(16).padStart(64, '0'), 'hex')
}
export function encodeMockReport(mint: string, price: bigint, timestamp: number) {
  if (price <= 0n || price > (1n << 128n) - 1n || !Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 0xffffffff - feedConfig.report_ttl_seconds) {
    throw new Error('Mock 报告价格或时间戳无效。')
  }
  const blob = Buffer.concat([
    mockFeed(mint).feedId.toBuffer(), word(timestamp), word(timestamp), word(0), word(0),
    word(timestamp + feedConfig.report_ttl_seconds), word(price), word(price), word(price),
  ])
  // (bytes32[3] context, bytes blob, bytes32[] rs, bytes32[] ss, bytes32 vs)
  // Mock verifier 不验证签名，两个签名数组为空；保留完整 ABI 格式。
  return Buffer.concat([
    Buffer.alloc(96), word(224), word(256 + blob.length), word(288 + blob.length), Buffer.alloc(32),
    word(blob.length), blob, word(0), word(0),
  ])
}

export function mockPriceInstructions(mint: string, price: bigint, timestamp: number, create: boolean) {
  const { address, feedId, token } = mockFeed(mint)
  const instructions: TransactionInstruction[] = []
  if (create) instructions.push(new TransactionInstruction({
    programId: storeProgram,
    keys: [
      { pubkey: mockAuthority, isSigner: true, isWritable: true },
      { pubkey: storeAddress, isSigner: false, isWritable: false },
      { pubkey: address, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionCoder.encode('initialize_price_feed', { index: feedConfig.index, provider: feedConfig.provider, token, feed_id: feedId }),
  }))
  const report = encodeMockReport(mint, price, timestamp)
  const configAccount = PublicKey.findProgramAddressSync([report.subarray(0, 32)], mockProgram)[0]
  instructions.push(new TransactionInstruction({
    programId: storeProgram,
    keys: [
      { pubkey: mockAuthority, isSigner: true, isWritable: false },
      { pubkey: storeAddress, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(initialization.verifier), isSigner: false, isWritable: false },
      { pubkey: new PublicKey(initialization.access_controller), isSigner: false, isWritable: false },
      { pubkey: configAccount, isSigner: false, isWritable: false },
      { pubkey: address, isSigner: false, isWritable: true },
      { pubkey: mockProgram, isSigner: false, isWritable: false },
    ],
    data: instructionCoder.encode('update_price_feed_with_chainlink', { compressed_report: Buffer.from(compress(report)) }),
  }))
  return instructions
}

export async function prepareMockPrice(connection: Connection, wallet: PublicKey, mint: string, input: string) {
  if (!wallet.equals(mockAuthority)) throw new Error('请连接本项目的管理员钱包提交 Mock 报价。')
  const price = parseMockPrice(input)
  if (await connection.getGenesisHash() !== deployment.genesis_hash) throw new Error('当前 RPC 不是 devnet，已停止提交。')
  const [store, clock, feed] = await connection.getMultipleAccountsInfo([storeAddress, SYSVAR_CLOCK_PUBKEY, mockFeed(mint).address], 'confirmed')
  if (!store || !hasPriceKeeper(store)) throw new Error('管理员钱包当前没有启用的 PRICE_KEEPER 权限。')
  if (!clock) throw new Error('无法读取链上时间，请重试。')
  const timestamp = Number(clock.data.readBigInt64LE(32))
  const previous = decodeMockPrice(mint, feed)
  if (timestamp < previous.timestamp) throw new Error('链上时间早于上一次报价，请稍后重试。')
  const latest = await connection.getLatestBlockhash('confirmed')
  const transaction = new Transaction({ feePayer: wallet, ...latest }).add(...mockPriceInstructions(mint, price, timestamp, !feed))
  return { transaction, latest, createsAccount: !feed }
}
