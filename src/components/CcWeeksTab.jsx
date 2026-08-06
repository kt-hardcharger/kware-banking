import { useMemo, useState } from 'react'
import { buildGoogleCalendarUrl } from '../lib/googleCalendar'

const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CcWeeksTab({ cc }) {
  const [activeWeekNum, setActiveWeekNum] = useState(1)
  const { computed, transactions, handleWeekFieldChange, deleteTransactionRow } = cc
  const active = computed.find((c) => c.week.week_number === activeWeekNum)

  // This week's card activity — charges and any statement credits dated within the week.
  const weekTransactions = useMemo(() => {
    if (!active) return []
    return transactions.filter((t) => t.txn_date >= active.week.start_date && t.txn_date <= active.week.end_date)
  }, [transactions, active])

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
              Beginning card balance
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

          <div className="stat-grid stat-grid-3">
            <div className="stat-field">
              <span className="stat-label">Checking Balance (before money move)</span>
              <span className="stat-value mono-num">{money(active.thresholdAmt)}</span>
            </div>
            <div className="stat-field">
              <span className="stat-label">Available funds</span>
              <span className="stat-value mono-num">{money(active.available)}</span>
            </div>
            <div className="stat-field">
              <span className="stat-label">Total spent this week</span>
              <span className="stat-value mono-num">{money(active.weekSpend)}</span>
            </div>
          </div>

          <div className="transfer-row">
            <span>
              Move <strong className="mono-num">{money(active.transfer.amount)}</strong> from{' '}
              {active.transfer.direction === 'cc_to_bank' ? 'Card → Bank' : 'Bank → Card'}
              {' '}by <strong>{active.week.start_date}</strong>
            </span>
            <div className="transfer-actions">
              <a
                className="btn-cal"
                href={buildGoogleCalendarUrl({
                  title: `KWARE: Move ${money(active.transfer.amount)} ${
                    active.transfer.direction === 'cc_to_bank' ? 'Card → Bank' : 'Bank → Card'
                  }`,
                  dateISO: active.week.start_date,
                  details: `Week ${active.week.week_number} credit card banking transfer (${active.week.start_date} – ${active.week.end_date}).`,
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
            Card balance after Week {active.week.week_number}:{' '}
            <span className="mono-num">{money(active.endingBalance)}</span>
          </p>
        </section>
      )}

      <section className="card">
        <h3>
          {weekTransactions.length} transaction{weekTransactions.length === 1 ? '' : 's'} this week
        </h3>
        {weekTransactions.length === 0 ? (
          <p className="dim">Nothing posted this week — head to the Import tab to add charges.</p>
        ) : (
          <table className="summary-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {weekTransactions.map((t) => (
                <tr key={t.id}>
                  <td className="dim">{t.txn_date}</td>
                  <td>{t.description}</td>
                  <td className={`mono-num ${t.amount > 0 ? '' : 'ok-text'}`}>{money(t.amount)}</td>
                  <td className="dim">{t.status}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => deleteTransactionRow(t.id)}
                      aria-label={`Remove ${t.description}`}
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
