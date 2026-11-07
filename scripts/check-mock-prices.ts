// 仅使用 CLI 的 RPC URL 和公开钱包地址做无签名模拟，不读取私钥、不发送交易。
import { execFileSync } from 'node:child_process'
import { Buffer } from 'buffer'
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { decodeMockPrice, mockAuthority, mockFeed, mockPriceInstructions, parseMockPrice, prepareMockPrice, readMockPrices } from '../admin-ui/src/lib/mock-prices.js'
import { supportedTokens } from '../admin-ui/src/lib/tokens.js'

async function main() {
  const config = execFileSync('solana', ['config', 'get'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const rpc = config.split('\n').find((line) => line.startsWith('RPC URL:'))?.slice('RPC URL:'.length).trim()
  if (!rpc) throw new Error('无法读取 CLI RPC')
  const connection = new Connection(rpc, { commitment: 'confirmed', fetch: async (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20_000) }) })
  const prices = await readMockPrices(connection, supportedTokens.map((token) => token.mint))
  console.log('devnet 网络及 9 个报价账户读取成功；已有账户：', Object.values(prices).filter((price) => price.exists).length)
  const token = supportedTokens[0]
  const { transaction, createsAccount } = await prepareMockPrice(connection, mockAuthority, token.mint, '60000')
  const result = await connection.simulateTransaction(new VersionedTransaction(transaction.compileMessage()), { sigVerify: false, commitment: 'confirmed', accounts: { encoding: 'base64', addresses: [mockFeed(token.mint).address.toBase58()] } })
  console.log('模拟模式：', createsAccount ? '创建账户并报价' : '更新报价')
  console.log('消耗 CU：', result.value.unitsConsumed)
  if (result.value.err) {
    console.log('模拟错误：', JSON.stringify(result.value.err))
    console.log(result.value.logs?.join('\n'))
    process.exitCode = 1
  } else {
    const account = result.value.accounts?.[0]
    if (!account) throw new Error('模拟未返回报价账户')
    const decode = (account: NonNullable<typeof result.value.accounts>[number]) => {
      if (!account) throw new Error('模拟未返回报价账户')
      return decodeMockPrice(token.mint, { ...account, owner: new PublicKey(account.owner), data: Buffer.from(account.data[0], 'base64') })
    }
    const quote = decode(account)
    if (quote.price !== '60000') throw new Error('报价回读不一致')
    transaction.add(...mockPriceInstructions(token.mint, parseMockPrice('60001'), quote.timestamp, false))
    const update = await connection.simulateTransaction(new VersionedTransaction(transaction.compileMessage()), { sigVerify: false, commitment: 'confirmed', accounts: { encoding: 'base64', addresses: [quote.address] } })
    if (update.value.err || decode(update.value.accounts?.[0] ?? null).price !== '60001') throw new Error('更新报价模拟失败')
    console.log('创建、回读和再次更新模拟通过；未创建真实账户、未修改链上价格。')
  }
}
main().catch(() => {
  console.error('链上读取或模拟未完成（未输出 RPC 地址及凭据）。')
  process.exitCode = 1
})
