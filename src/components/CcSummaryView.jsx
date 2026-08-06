import { useEffect, useState } from 'react'
import { getModuleSettings, listMonths, listWeeks, listCcTransactions } from '../lib/db'
import { computeAllCcWeeks } from '../lib/ccWeekMath'
import Sparkline from './Sparkline'

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CcSummaryView({ selectedMonth, selectedYear }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const settings = await getModuleSettings('credit_card')
        const months = await listMonths('credit_card') // newest first

        const results = await Promise.all(
          months.map(async (m) => {
            const [weeks, transactions] = await Promise.all([listWeeks(m.id), listCcTransactions(m.id)])
            const chain = computeAllCcWeeks({ settings, monthRow: m, weeks, transactions })
            const endingBalance = chain.length ? chain[chain.length - 1].endingBalance : m.opening_balance
            const totalSpent = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
            return {
              id: m.id,
              month: m.month,
              year: m.year,
              opening: m.opening_balance,
              ending: endingBalance,
              delta: endingBalance - m.opening_balance,
              totalSpent,
              weeksTracked: chain.length,
            }
          })
        )

        // Oldest → newest for a left-to-right trend line and table.
        results.sort((a, b) => (a.year - b.year) || (a.month - b.month))
        if (!cancelled) setRows(results)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="error-text">Error: {error}</p>
  if (!rows) return <p className="dim">Loading…</p>

  if (rows.length === 0) {
    return (
      <div className="placeholder-card">
        <span className="phase-tag">Summary</span>
        <h2>Nothing to summarize yet</h2>
        <p>Create at least one month under Weeks and it'll show up here.</p>
      </div>
    )
  }

  const points = rows.map((r) => ({ label: `${MONTH_ABBR[r.month - 1]} ${String(r.year).slice(2)}`, value: r.ending }))
  const netChange = rows[rows.length - 1].ending - rows[0].opening
  const totalSpentAllTime = rows.reduce((sum, r) => sum + r.totalSpent, 0)
  const selectedRow = rows.find((r) => r.month === selectedMonth && r.year === selectedYear)

  return (
    <div className="heloc-view">
      {selectedRow && (
        <section className="card">
          <h3>
            {MONTH_NAMES[selectedRow.month - 1]} {selectedRow.year}{' '}
            <span className="dim mono-num">(currently viewing)</span>
          </h3>
          <div className="stat-grid">
            <div className="stat-field">
              <span className="stat-label">Opening balance</span>
              <span className="stat-value mono-num">{money(selectedRow.opening)}</span>
            </div>
            <div className="stat-field">
              <span className="stat-label">Ending balance</span>
              <span className="stat-value mono-num">{money(selectedRow.ending)}</span>
            </div>
            <div className="stat-field">
              <span className="stat-label">Change</span>
              <span className={`stat-value mono-num ${selectedRow.delta <= 0 ? 'ok-text' : 'error-text'}`}>
                {selectedRow.delta <= 0 ? '' : '+'}
                {money(selectedRow.delta)}
              </span>
            </div>
            <div className="stat-field">
              <span className="stat-label">Total spent</span>
              <span className="stat-value mono-num">{money(selectedRow.totalSpent)}</span>
            </div>
          </div>
          <p className="dim">{selectedRow.weeksTracked}/4 weeks tracked</p>
        </section>
      )}

      <section className="card">
        <h3>Card balance over time</h3>
        <Sparkline points={points} stroke="var(--cc)" />
        <p className="dim">
          Net change across all tracked months:{' '}
          <span className={netChange <= 0 ? 'ok-text' : 'error-text'}>{money(netChange)}</span>
          {' '}({netChange <= 0 ? 'balance went down' : 'balance went up'})
        </p>
        <p className="dim">Total spent across all tracked months: <span className="mono-num">{money(totalSpentAllTime)}</span></p>
      </section>

      <section className="card">
        <h3>By month</h3>
        <table className="summary-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Opening</th>
              <th>Ending</th>
              <th>Change</th>
              <th>Total spent</th>
              <th>Weeks tracked</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .slice()
              .reverse()
              .map((r) => (
                <tr key={r.id} className={r.id === selectedRow?.id ? 'selected-row' : undefined}>
                  <td>{MONTH_ABBR[r.month - 1]} {r.year}</td>
                  <td className="mono-num">{money(r.opening)}</td>
                  <td className="mono-num">{money(r.ending)}</td>
                  <td className={`mono-num ${r.delta <= 0 ? 'ok-text' : 'error-text'}`}>
                    {r.delta <= 0 ? '' : '+'}
                    {money(r.delta)}
                  </td>
                  <td className="mono-num">{money(r.totalSpent)}</td>
                  <td className="dim">{r.weeksTracked}/4</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
