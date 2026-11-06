import { useCallback, useEffect, useMemo, useState } from 'react'
import { createAssociatedTokenAccountInstruction, createMintToInstruction, getAccount, getAssociatedTokenAddress, getMint } from '@solana/spl-token'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Check, ExternalLink, LoaderCircle, Plus, RefreshCw, X } from 'lucide-react'
import { PublicKey, Transaction } from '@solana/web3.js'
import { supportedTokens, type SupportedToken } from '../../lib/tokens'

type TokenBalance = { amount: bigint; exists: boolean }

function formatAmount(amount: bigint, decimals: number) {
  const value = amount.toString().padStart(decimals + 1, '0')
  const whole = decimals ? value.slice(0, -decimals) : value
  const fraction = decimals ? value.slice(-decimals).replace(/0+$/, '') : ''
  return fraction ? `${whole}.${fraction}` : whole
}

function parseAmount(value: string, decimals: number): bigint {
  if (!/^\d+(\.\d*)?$/.test(value)) throw new Error('请输入大于 0 的有效数量。')
  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > decimals) throw new Error(`最多只能输入 ${decimals} 位小数。`)
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0')
  if (raw <= 0n || raw > 18_446_744_073_709_551_615n) throw new Error('增发数量超出 SPL Token 支持范围。')
  return raw
}

function shortKey(key: string) {
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

export default function TokenPage() {
  const { connection } = useConnection()
  const { connected, publicKey, sendTransaction } = useWallet()
  const [balances, setBalances] = useState<Record<string, TokenBalance>>({})
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<SupportedToken | null>(null)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ symbol: string; signature: string } | null>(null)

  const canMint = useMemo(() => publicKey && supportedTokens.some((token) => token.mintAuthority === publicKey.toBase58()), [publicKey])

  const refreshBalances = useCallback(async () => {
    if (!publicKey) {
      setBalances({})
      return
    }
    setLoading(true)
    try {
      const entries = await Promise.all(supportedTokens.map(async (token) => {
        const mint = new PublicKey(token.mint)
        const ata = await getAssociatedTokenAddress(mint, publicKey)
        try {
          const account = await getAccount(connection, ata)
          return [token.mint, { amount: account.amount, exists: true }] as const
        } catch (cause) {
          if (cause instanceof Error && cause.name === 'TokenAccountNotFoundError') return [token.mint, { amount: 0n, exists: false }] as const
          if (cause instanceof Error && cause.name === 'TokenInvalidAccountOwnerError') return [token.mint, { amount: 0n, exists: false }] as const
          throw cause
        }
      }))
      setBalances(Object.fromEntries(entries))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '读取 Token 余额失败。')
    } finally {
      setLoading(false)
    }
  }, [connection, publicKey])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!publicKey) {
        setBalances({})
        return
      }
      setLoading(true)
      try {
        const entries = await Promise.all(supportedTokens.map(async (token) => {
          const mint = new PublicKey(token.mint)
          const ata = await getAssociatedTokenAddress(mint, publicKey)
          try {
            const account = await getAccount(connection, ata)
            return [token.mint, { amount: account.amount, exists: true }] as const
          } catch (cause) {
            if (cause instanceof Error && ['TokenAccountNotFoundError', 'TokenInvalidAccountOwnerError'].includes(cause.name)) return [token.mint, { amount: 0n, exists: false }] as const
            throw cause
          }
        }))
        if (active) setBalances(Object.fromEntries(entries))
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '读取 Token 余额失败。')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [connection, publicKey])

  async function submitMint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !publicKey || !connected) return
    setError('')
    setNotice(null)
    setSubmitting(true)
    try {
      const rawAmount = parseAmount(amount, selected.decimals)
      const mint = new PublicKey(selected.mint)
      const mintInfo = await getMint(connection, mint)
      if (!mintInfo.mintAuthority?.equals(publicKey)) throw new Error('当前钱包不是该 Token 的增发权限持有者。')
      const destination = await getAssociatedTokenAddress(mint, publicKey)
      const transaction = new Transaction()
      const destinationInfo = await connection.getAccountInfo(destination)
      if (!destinationInfo) transaction.add(createAssociatedTokenAccountInstruction(publicKey, destination, publicKey, mint))
      transaction.add(createMintToInstruction(mint, destination, publicKey, rawAmount))
      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, 'confirmed')
      setNotice({ symbol: selected.symbol, signature })
      setSelected(null)
      setAmount('')
      await refreshBalances()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '增发交易失败。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">DEVNET ASSETS</p>
          <h1 className="mt-1">Token 管理</h1>
        </div>
        <button type="button" onClick={() => void refreshBalances()} disabled={!publicKey || loading} title="刷新余额" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />刷新余额
        </button>
      </div>

      {!connected && <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">连接管理员钱包后可查看余额并增发 Token。</div>}
      {connected && !canMint && <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">当前钱包没有这 9 个测试 Token 的增发权限。请连接管理员钱包 {shortKey(supportedTokens[0].mintAuthority)}。</div>}
      {error && !selected && <div role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {notice && <div className="flex flex-wrap items-center gap-2 border-l-4 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><Check size={16} />{notice.symbol} 增发成功，<a className="inline-flex items-center gap-1 underline" href={`https://explorer.solana.com/tx/${notice.signature}?cluster=devnet`} target="_blank" rel="noreferrer">查看交易<ExternalLink size={13} /></a></div>}

      <div className="overflow-x-auto border-y border-slate-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3 font-medium">资产</th><th className="px-4 py-3 font-medium">Mint 地址</th><th className="px-4 py-3 font-medium">精度</th><th className="px-4 py-3 text-right font-medium">当前钱包余额</th><th className="px-4 py-3 text-right font-medium">操作</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {supportedTokens.map((token) => {
              const balance = balances[token.mint]
              return <tr key={token.mint} className="hover:bg-slate-50/70">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={token.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /><div><div className="font-semibold text-slate-900">{token.symbol}</div><div className="text-xs text-slate-500">{token.name}</div></div></div></td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600" title={token.mint}>{shortKey(token.mint)}</td>
                <td className="px-4 py-3 text-slate-600">{token.decimals}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">{publicKey ? (loading && !balance ? '…' : balance ? formatAmount(balance.amount, token.decimals) : '—') : '连接钱包'}</td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={() => { setSelected(token); setAmount(''); setError('') }} disabled={!canMint || submitting} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={15} />增发</button></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setSelected(null) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="mint-title" className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4"><div><h2 id="mint-title" className="text-lg font-semibold text-slate-950">增发 {selected.symbol}</h2><p className="mt-1 text-sm text-slate-500">数量将发送至当前连接钱包。</p></div><button type="button" title="关闭" onClick={() => setSelected(null)} disabled={submitting} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
          <form onSubmit={submitMint} className="mt-5 space-y-4">
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">增发数量
              <div className="flex items-center rounded-md border border-slate-300 focus-within:border-slate-700 focus-within:ring-1 focus-within:ring-slate-700"><input autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono outline-none" aria-describedby="amount-hint" /><span className="px-3 text-sm text-slate-500">{selected.symbol}</span></div>
            </label>
            <p id="amount-hint" className="text-xs text-slate-500">最多 {selected.decimals} 位小數。接收地址：{publicKey ? shortKey(publicKey.toBase58()) : ''}</p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setSelected(null)} disabled={submitting} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">取消</button><button type="submit" disabled={submitting || !amount} className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">{submitting ? <><LoaderCircle size={16} className="animate-spin" />等待钱包确认</> : '确认增发'}</button></div>
          </form>
        </section>
      </div>}
    </section>
  )
}
