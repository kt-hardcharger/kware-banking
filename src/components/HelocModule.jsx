import { useState } from 'react'
import HelocMonthView from './HelocMonthView'
import HelocSummaryView from './HelocSummaryView'

export default function HelocModule() {
  const [tab, setTab] = useState('months')

  return (
    <div>
      <div className="submodule-tabs">
        <button
          type="button"
          className={`submodule-tab${tab === 'months' ? ' active' : ''}`}
          onClick={() => setTab('months')}
        >
          Monthly Tracking
        </button>
        <button
          type="button"
          className={`submodule-tab${tab === 'summary' ? ' active' : ''}`}
          onClick={() => setTab('summary')}
        >
          Summary
        </button>
      </div>

      {tab === 'months' ? <HelocMonthView /> : <HelocSummaryView />}
    </div>
  )
}
