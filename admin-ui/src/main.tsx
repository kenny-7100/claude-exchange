import { StrictMode } from 'react'
import './polyfills'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'

const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl('devnet')
const connectionConfig = { wsEndpoint: import.meta.env.VITE_SOLANA_WS_URL || undefined }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <BrowserRouter>
            <ErrorBoundary><App /></ErrorBoundary>
          </BrowserRouter>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>,
)
