import { MONTH_NAMES } from '../lib/useHelocMonth'

export default function MonthBar({ heloc }) {
  const { month, year, monthRow, monthsList, handlePickExistingMonth, handleNewMonth } = heloc

  return (
    <div className="month-bar">
      <label>
        View month
        <select
          value={monthRow?.id ?? ''}
          onChange={(e) => (e.target.value ? handlePickExistingMonth(e.target.value) : null)}
          disabled={monthsList.length === 0}
        >
          {monthsList.length === 0 && <option value="">No months yet</option>}
          {!monthRow && monthsList.length > 0 && (
            <option value="" disabled>
              {MONTH_NAMES[month - 1]} {year} (new — not created)
            </option>
          )}
          {monthsList.map((m) => (
            <option key={m.id} value={m.id}>
              {MONTH_NAMES[m.month - 1]} {m.year}
            </option>
          ))}
        </select>
      </label>
      <button className="btn-secondary" onClick={handleNewMonth}>
        + New Month
      </button>
    </div>
  )
}

export function CreateMonthCard({ heloc, onCreate }) {
  const { month, year, openingBalanceInput, setOpeningBalanceInput, carryForwardNote } = heloc

  return (
    <div className="placeholder-card">
      <span className="phase-tag">No data yet for {MONTH_NAMES[month - 1]} {year}</span>
      <h2>Create {MONTH_NAMES[month - 1]} {year}</h2>
      <p>Set the opening HELOC balance to start tracking this month.</p>
      <label className="field">
        Opening HELOC balance
        <input
          type="number"
          step="0.01"
          value={openingBalanceInput}
          onChange={(e) => setOpeningBalanceInput(e.target.value)}
        />
        {carryForwardNote && <span className="hint">{carryForwardNote}</span>}
      </label>
      <button className="btn-primary" onClick={onCreate}>
        Create {MONTH_NAMES[month - 1]} {year}
      </button>
    </div>
  )
}
