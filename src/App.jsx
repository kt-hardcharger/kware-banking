import { useState } from 'react'
import ConnectionStatus from './components/ConnectionStatus'
import HelocMonthView from './components/HelocMonthView'

const MODULES = {
  heloc: {
    label: 'HELOC Banking',
  },
  credit_card: {
    label: 'Credit Card Banking',
    blurb:
      'Weekly Checking → Credit Card transfers to fund non-bill spending and pay the card to zero. Charge import and weekly spend totals land in Phase 5.',
  },
}

export default function App() {
  const [module, setModule] = useState('heloc')
  const active = MODULES[module]

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

      <main className="main-content">
        {module === 'heloc' ? (
          <HelocMonthView />
        ) : (
          <section className="placeholder-card">
            <span className="phase-tag">Phase 5 · Not built yet</span>
            <h2>{active.label}</h2>
            <p>{active.blurb}</p>
          </section>
        )}
      </main>
    </div>
  )
}
