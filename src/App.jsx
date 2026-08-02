import { useState } from 'react'
import ConnectionStatus from './components/ConnectionStatus'
import HelocModule from './components/HelocModule'
import CcModule from './components/CcModule'

const MODULES = {
  heloc: {
    label: 'HELOC Banking',
  },
  credit_card: {
    label: 'Credit Card Banking',
  },
}

export default function App() {
  const [module, setModule] = useState('heloc')

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark">
            <span className="k">K</span>WARE Banking
          </span>
          <span className="brand-sub">velocity ledger</span>
        </div>

        <nav className="module-switcher" aria-label="Banking module">
          {Object.entries(MODULES).map(([key, m]) => (
            <button
              key={key}
              type="button"
              data-module={key}
              className={`module-btn${module === key ? ' active' : ''}`}
              onClick={() => setModule(key)}
              aria-pressed={module === key}
            >
              {m.label}
            </button>
          ))}
        </nav>

        <ConnectionStatus />
      </header>

      <main className="main-content">{module === 'heloc' ? <HelocModule /> : <CcModule />}</main>
    </div>
  )
}
