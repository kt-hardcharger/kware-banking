import { useState } from 'react'
import { useCcMonth } from '../lib/useCcMonth'
import MonthBar, { CreateMonthCard } from './MonthBar'
import CcWeeksTab from './CcWeeksTab'
import CcImportTab from './CcImportTab'
import CcSummaryView from './CcSummaryView'

const TABS = [
  { key: 'weeks', label: 'Weeks' },
  { key: 'import', label: 'Import' },
  { key: 'summary', label: 'Summary' },
]

export default function CcModule() {
  const [tab, setTab] = useState('weeks')
  const cc = useCcMonth()

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
        <CcSummaryView />
      ) : cc.loading ? (
        <p className="dim">Loading…</p>
      ) : cc.error ? (
        <p className="error-text">Error: {cc.error}</p>
      ) : (
        <div className="heloc-view">
          {/* MonthBar/CreateMonthCard are shared with the HELOC module — same shape of state, so no duplication needed. */}
          <MonthBar heloc={cc} />
          {!cc.monthRow ? (
            <CreateMonthCard heloc={cc} onCreate={cc.handleCreateMonth} targetLabel="Credit Card" />
          ) : tab === 'weeks' ? (
            <CcWeeksTab cc={cc} />
          ) : (
            <CcImportTab cc={cc} />
          )}
        </div>
      )}
    </div>
  )
}
