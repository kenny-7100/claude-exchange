import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { BorshAccountsCoder, BorshInstructionCoder, type Idl } from '@coral-xyz/anchor'
import { Buffer } from 'buffer'
import { uncompress } from 'snappyjs'
import BN from 'bn.js'
import { PublicKey, Transaction } from '@solana/web3.js'
import { decimalAmount, decodeMockPrice, encodeMockReport, mockAuthority, mockFeed, mockPriceInstructions, parseMockPrice, storeAddress, storeProgram } from '../src/lib/mock-prices'
import { supportedTokens } from '../src/lib/tokens'
import idl from '../src/lib/idl/mock-store.json'
import feedConfig from '../../config/devnet-mock-price-feeds.json'

const mint = supportedTokens[0].mint
const timestamp = 1_800_000_000
const word = (bytes: Uint8Array, offset: number) => BigInt('0x' + Buffer.from(bytes.subarray(offset, offset + 32)).toString('hex'))

test('精度不经过浮点数，拒绝无效价格和溢出', () => {
  for (const value of ['0.000000000000000001', '60000.123456789123456789', '1', '340282366920938463463.374607431768211455']) {
    assert.equal(decimalAmount(parseMockPrice(value), 18), value)
  }
  for (const value of ['0', '-1', 'NaN', '1e5', '1.0000000000000000001', '340282366920938463463.374607431768211456']) assert.throws(() => parseMockPrice(value))
})

test('9 个固定来源互不冲突，Feed ID 为 V3，不依赖连接钱包', () => {
  const feeds = supportedTokens.map((token) => mockFeed(token.mint))
  assert.equal(new Set(feeds.map((feed) => feed.address.toBase58())).size, 9)
  assert.equal(new Set(feeds.map((feed) => feed.feedId.toBase58())).size, 9)
  for (const feed of feeds) assert.deepEqual([...feed.feedId.toBytes().slice(0, 2)], [0, 3])
})

test('V3 报告 ABI 字段、压缩和 IDL 指令往返匹配', () => {
  const raw = parseMockPrice('60000.123456789123456789')
  const report = encodeMockReport(mint, raw, timestamp)
  const offset = Number(word(report, 96))
  const length = Number(word(report, offset))
  const blob = report.subarray(offset + 32, offset + 32 + length)
  assert.equal(length, 9 * 32)
  assert.ok(blob.subarray(0, 32).equals(mockFeed(mint).feedId.toBuffer()))
  assert.equal(word(blob, 32), BigInt(timestamp))
  assert.equal(word(blob, 64), BigInt(timestamp))
  assert.equal(word(blob, 160), BigInt(timestamp + feedConfig.report_ttl_seconds))
  for (const offset of [192, 224, 256]) assert.equal(word(blob, offset), raw)
  const instructions = mockPriceInstructions(mint, raw, timestamp, true)
  const decoded = new BorshInstructionCoder(idl as Idl).decode(instructions[1].data)!
  assert.equal(decoded.name, 'update_price_feed_with_chainlink')
  assert.deepEqual(Buffer.from(uncompress((decoded.data as { compressed_report: Buffer }).compressed_report)), report)
  assert.equal(mockPriceInstructions(mint, raw, timestamp, false).length, 1)
})

test('创建和更新能放在一笔普通交易内，仅管理员签名', () => {
  const transaction = new Transaction({ feePayer: mockAuthority, recentBlockhash: PublicKey.default.toBase58() })
    .add(...mockPriceInstructions(mint, parseMockPrice('60000'), timestamp, true))
  assert.equal(transaction.compileMessage().header.numRequiredSignatures, 1)
  assert.ok(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length <= 1232)
})

test('解码链上账户，验证 owner 和来源；未创建账户与零报价分开处理', async () => {
  const feed = mockFeed(mint)
  const coder = new BorshAccountsCoder(idl as Idl)
  const data = await coder.encode('PriceFeed', {
    bump: 0, provider: 0, index: 0, padding_0: Array(12).fill(0), store: storeAddress,
    authority: mockAuthority, token: feed.token, feed_id: feed.feedId,
    last_published_at_slot: new BN(123), last_published_at: new BN(timestamp),
    price: { decimals: 18, flags: { value: 1 }, market_status_value: 0, padding: [0], last_update_diff: 0, ts: new BN(timestamp), price: new BN('60000000000000000000000'), min_price: new BN('60000000000000000000000'), max_price: new BN('60000000000000000000000') },
    reserved: Array(256).fill(0),
  })
  const account = { data, owner: storeProgram, executable: false, lamports: 1 }
  assert.equal(decodeMockPrice(mint, account).price, '60000')
  assert.equal(decodeMockPrice(mint, null).exists, false)
  assert.throws(() => decodeMockPrice(mint, { ...account, owner: PublicKey.default }))
  assert.throws(() => decodeMockPrice(supportedTokens[1].mint, account))
})

test('提取的 IDL 与仓库源 IDL 保持一致', () => {
  const source = JSON.parse(readFileSync(new URL('../../crates/programs/idls/gmsol_store.json', import.meta.url), 'utf8'))
  function stripDocs(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripDocs)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'docs').map(([key, item]) => [key, stripDocs(item)]))
  }
  for (const item of idl.instructions) assert.deepEqual(item, stripDocs(source.instructions.find((ix: { name: string }) => ix.name === item.name)))
  for (const item of idl.types) assert.deepEqual(item, stripDocs(source.types.find((type: { name: string }) => type.name === item.name)))
})
