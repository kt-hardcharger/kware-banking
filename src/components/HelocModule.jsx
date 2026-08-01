import { useState } from 'react'
import { useHelocMonth } from '../lib/useHelocMonth'
import MonthBar, { CreateMonthCard } from './MonthBar'
import WeeksTab from './WeeksTab'
import ImportTab from './ImportTab'
import HelocSummaryView from './HelocSummaryView'

const TABS = [
  { key: 'weeks', label: 'Weeks' },
  { key: 'import', label: 'Import' },
  { key: 'summary', label: 'Summary' },
]

export default function HelocModule() {
  const [tab, setTab] = useState('weeks')
  const heloc = useHelocMonth()

  return (
    <div>
      <div className="submodule-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`submodule-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' ? (
        <HelocSummaryView />
      ) : heloc.loading ? (
        <p className="dim">Loading…</p>
      ) : heloc.error ? (
        <p className="error-text">Error: {heloc.error}</p>
      ) : (
        <div className="heloc-view">
          <MonthBar heloc={heloc} />
          {!heloc.monthRow ? (
            <CreateMonthCard heloc={heloc} onCreate={heloc.handleCreateMonth} />
          ) : tab === 'weeks' ? (
            <WeeksTab heloc={heloc} />
          ) : (
            <ImportTab heloc={heloc} />
          )}
        </div>
      )}
    </div>
  )
}
