import { lazy, Suspense } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { cn } from './lib/utils'
import HomePage from './pages/home'

const MarketPage = lazy(() => import('./pages/market'))
const PoolPage = lazy(() => import('./pages/pool'))
const TokenPage = lazy(() => import('./pages/token'))

const navigation = [
  { to: '/', label: 'Home' },
  { to: '/market', label: 'Market' },
  { to: '/pool', label: 'Pool' },
  { to: '/token', label: 'Token' },
]

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-slate-950">
            GMX Solana Lab
          </Link>
          <div className="flex flex-wrap items-center gap-4">
          <nav aria-label="主导航" className="flex flex-wrap gap-2">
            {navigation.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) => cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                )}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">Devnet</span>
          <WalletMultiButton className="!h-10 !rounded-md !bg-slate-900 !text-sm hover:!bg-slate-700" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Suspense fallback={<p role="status">正在加载页面…</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/pool" element={<PoolPage />} />
            <Route path="/token" element={<TokenPage />} />
            <Route path="*" element={
              <section className="space-y-4">
                <h1>页面不存在</h1>
                <p>请通过上方导航选择页面，或<Link to="/" className="underline">返回 Home</Link>。</p>
              </section>
            } />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
