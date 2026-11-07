import { useEffect, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, X } from 'lucide-react'
import { hasPriceKeeper, mockAuthority, parseMockPrice, prepareMockPrice, readMockPrices, storeAddress } from '../../lib/mock-prices'
import type { SupportedToken } from '../../lib/tokens'

export default function MockQuoteDialog({ token, onClose, onSuccess }: {
  token: SupportedToken
  onClose: () => void
  onSuccess: (signature: string) => void
}) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const client = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const walletRef = useRef(publicKey?.toBase58())
  useEffect(() => { walletRef.current = publicKey?.toBase58() }, [publicKey])
  const [value, setValue] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'signing' | 'confirming'>('idle')
  const [error, setError] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const busy = phase !== 'idle'
  const quote = useQuery({
    queryKey: ['mock-price', connection.rpcEndpoint, token.mint],
    queryFn: async () => (await readMockPrices(connection, [token.mint]))[token.mint],
    staleTime: 0,
    retry: false,
  })
  const permission = useQuery({
    queryKey: ['mock-price-permission', connection.rpcEndpoint, publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey?.equals(mockAuthority)) return false
      const store = await connection.getAccountInfo(storeAddress, 'confirmed')
      return !!store && hasPriceKeeper(store)
    },
    retry: false,
    staleTime: 0,
  })
  const price = value ?? quote.data?.price ?? ''
  const ready = !quote.isFetching && !quote.isError && !!quote.data
  useEffect(() => {
    if (ready) inputRef.current?.focus()
  }, [ready])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('keydown', escape); focus?.focus() }
  }, [busy, onClose])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!publicKey || !ready || busy || signature) return
    setError('')
    setPhase('preparing')
    try {
      parseMockPrice(price)
      const wallet = publicKey.toBase58()
      const { transaction, latest } = await prepareMockPrice(connection, publicKey, token.mint, price)
      if (walletRef.current !== wallet) throw new Error('钱包已切换，请重新打开报价窗口。')
      setPhase('signing')
      const sent = await sendTransaction(transaction, connection, { preflightCommitment: 'confirmed' })
      setSignature(sent)
      setPhase('confirming')
      const result = await connection.confirmTransaction({ signature: sent, ...latest }, 'confirmed')
      if (result.value.err) {
        setSignature(null)
        throw new Error(`报价交易执行失败：${JSON.stringify(result.value.err)}`)
      }
      await client.invalidateQueries({ queryKey: ['mock-prices', connection.rpcEndpoint] })
      await client.invalidateQueries({ queryKey: ['mock-price', connection.rpcEndpoint, token.mint] })
      onSuccess(sent)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Mock 报价失败，请重试。')
    } finally {
      setPhase('idle')
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="mock-quote-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onKeyDown={(event) => {
      if (event.key !== 'Tab') return
      const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'))
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="mock-quote-title" className="text-lg font-semibold text-slate-950">{token.symbol} Mock 报价</h2><p className="mt-1 text-sm text-slate-500">设置该 Token 的 USD 测试价格。</p></div>
        <button type="button" aria-label="关闭" disabled={busy} onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X size={18} /></button>
      </div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        {!ready && !quote.isError && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />正在读取上一次报价…</p>}
        {quote.isError && <div role="alert" className="text-sm text-red-700">{quote.error.message} <button type="button" onClick={() => void quote.refetch()} className="underline">重试</button></div>}
        {ready && !quote.data?.exists && <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900">首次报价将创建该 Token 的 Mock 报价账户，并写入价格。需要支付少量 SOL 账户租金及交易费用，两项操作将在同一笔交易中完成。</p>}
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">价格
          <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"><input ref={inputRef} inputMode="decimal" value={price} onChange={(event) => setValue(event.target.value)} disabled={!ready || busy || !!signature} placeholder="请输入价格" aria-describedby="mock-price-hint" className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono outline-none disabled:opacity-50" /><span className="px-3 text-sm text-slate-500">USD</span></div>
        </label>
        <p id="mock-price-hint" className="text-xs leading-5 text-slate-500">最多支持 18 位小数。每次提交都会刷新报价时间；该价格仅用于本项目的 Mock 测试。</p>
        {ready && quote.data?.timestamp ? <p className="text-xs text-slate-500">上次报价：{new Date(quote.data.timestamp * 1000).toLocaleString('zh-CN')}</p> : null}
        {permission.isPending ? <p className="text-sm text-slate-500">正在核对报价权限…</p> : permission.isError ? <p role="alert" className="text-sm text-red-700">权限读取失败。<button type="button" onClick={() => void permission.refetch()} className="underline">重试</button></p> : !permission.data && <p role="alert" className="text-sm text-amber-800">需要连接具有 PRICE_KEEPER 权限的项目管理员钱包。</p>}
        {error && <p role="alert" className="break-words text-sm text-red-700">{error}</p>}
        {signature && <p className="text-sm leading-6 text-slate-600">交易已发送。{!busy && '确认结果尚不明确，请先查看交易结果并刷新列表，避免重复提交。'} <a className="text-indigo-600 underline" href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">查看交易</a></p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-lg border border-slate-300 px-4 text-sm text-slate-700 disabled:opacity-50">{signature ? '关闭' : '取消'}</button>
          <button type="submit" disabled={!ready || permission.isFetching || !permission.data || busy || !price || !!signature} className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
            {busy && <LoaderCircle size={15} className="animate-spin" />}
            {phase === 'preparing' ? '准备交易…' : phase === 'signing' ? '请在钱包中确认' : phase === 'confirming' ? '等待链上确认…' : '确定'}
          </button>
        </div>
      </form>
    </section>
  </div>
}
