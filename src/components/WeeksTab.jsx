import { useMemo, useState } from 'react'
import { buildGoogleCalendarUrl } from '../lib/googleCalendar'

const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function WeeksTab({ heloc }) {
  const [activeWeekNum, setActiveWeekNum] = useState(1)
  const { computed, bills, handleWeekFieldChange, deleteBillRow } = heloc
  const active = computed.find((c) => c.week.week_number === activeWeekNum)

  // This week's schedule — bills and income due within the week's date range.
  const weekBills = useMemo(() => {
    if (!active) return []
    return bills.filter((b) => b.due_date >= active.week.start_date && b.due_date <= active.week.end_date)
  }, [bills, active])

  return (
    <>
      <div className="week-tabs" role="tablist" aria-label="Week">
        {computed.map(({ week }) => (
          <button
            key={week.id}
            type="button"
            role="tab"
            aria-selected={activeWeekNum === week.week_number}
            className={`week-tab${activeWeekNum === week.week_number ? ' active' : ''}`}
            onClick={() => setActiveWeekNum(week.week_number)}
          >
            Week {week.week_number}
            {week.transfer_completed && <span className="tab-check">✓</span>}
          </button>
        ))}
      </div>

      {active && (
        <section className="card week-card">
          <h3>
            Week {active.week.week_number}{' '}
            <span className="dim mono-num">
              ({active.week.start_date} – {active.week.end_date})
            </span>
          </h3>

          <div className="week-grid">
            <label className="field">
              Beginning HELOC balance
              <input
                type="number"
                step="0.01"
                value={active.week.beginning_balance_override ?? active.beginningBalance}
                onChange={(e) =>
                  handleWeekFieldChange(
                    active.week,
                    'beginning_balance_override',
                    e.target.value === '' ? null : Number(e.target.value)
                  )
                }
              />
            </label>
            <label className="field">
              Bank checking balance
              <input
                type="number"
                step="0.01"
                value={active.week.bank_checking_balance}
                onChange={(e) => handleWeekFieldChange(active.week, 'bank_checking_balance', Number(e.target.value))}
              />
              {active.depositsHint > 0 && (
                <span className="hint">Import shows {money(active.depositsHint)} in deposits this week</span>
              )}
            </label>
            <label className="field">
              Other income
              <input
                type="number"
                step="0.01"
                value={active.week.other_income}
                onChange={(e) => handleWeekFieldChange(active.week, 'other_income', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="stat-grid">
            <div className="stat-field">
              <span className="stat-label">Checking Balance (before money move)</span>
              <span className="stat-value mono-num">{money(active.thresholdAmt)}</span>
            </div>
            <div className="stat-field">
              <span className="stat-label">Bank bills</span>
              <span className="stat-value mono-num">{money(active.bankBills)}</span>
            </div>
            <div className="stat-field">
              <span className="stat-label">Available funds</span>
              <span className="stat-value mono-num">{money(active.available)}</span>
            </div>
            <div className="stat-field">
              <span className="stat-label">HELOC bills</span>
              <span className="stat-value mono-num">{money(active.helocBills)}</span>
            </div>
          </div>

          <div className="transfer-row">
            <span>
              Move <strong className="mono-num">{money(active.transfer.amount)}</strong> from{' '}
              {active.transfer.direction === 'heloc_to_bank' ? 'HELOC → Bank' : 'Bank → HELOC'}
              {' '}by <strong>{active.moveDate}</strong>
              {active.transfer.direction === 'heloc_to_bank' && active.moveDate !== active.week.start_date && (
                <span className="dim"> (earliest bank bill due date this week)</span>
              )}
            </span>
            <div className="transfer-actions">
              <a
                className="btn-cal"
                href={buildGoogleCalendarUrl({
                  title: `KWARE: Move ${money(active.transfer.amount)} ${
                    active.transfer.direction === 'heloc_to_bank' ? 'HELOC → Bank' : 'Bank → HELOC'
                  }`,
                  dateISO: active.moveDate,
                  details: `Week ${active.week.week_number} velocity banking transfer (${active.week.start_date} – ${active.week.end_date}).`,
                })}
                target="_blank"
                rel="noreferrer"
              >
                Add reminder to Google Calendar
              </a>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={active.week.transfer_completed}
                  onChange={(e) => handleWeekFieldChange(active.week, 'transfer_completed', e.target.checked)}
                />
                Completed
              </label>
            </div>
          </div>

          <p className="ending-balance">
            HELOC balance after Week {active.week.week_number}:{' '}
            <span className="mono-num">{money(active.endingBalance)}</span>
          </p>
        </section>
      )}

      <section className="card">
        <h3>
          {weekBills.length} bill{weekBills.length === 1 ? '' : 's'}/income row{weekBills.length === 1 ? '' : 's'} this week
        </h3>
        {weekBills.length === 0 ? (
          <p className="dim">Nothing due this week — head to the Import tab to add bills or income.</p>
        ) : (
          <table className="summary-table">
            <thead>
              <tr>
                <th>Due</th>
                <th>Payee</th>
                <th>Amount</th>
                <th>Account</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {weekBills.map((b) => (
                <tr key={b.id}>
                  <td className="dim">{b.due_date}</td>
                  <td>{b.payee}</td>
                  <td className={`mono-num ${b.amount < 0 ? '' : 'ok-text'}`}>{money(b.amount)}</td>
                  <td className="dim">{b.account_used}</td>
                  <td className="dim">{b.status}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => deleteBillRow(b.id)}
                      aria-label={`Remove ${b.payee}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
