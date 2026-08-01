import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getModuleSettings,
  getMonth,
  createMonth,
  listWeeks,
  upsertWeek,
  updateWeek,
  listBills,
  insertBills,
  deleteBillsForMonth,
} from '../lib/db'
import { parseBillsPaste } from '../lib/billsParser'
import { getWeekBoundaries, computeWeek } from '../lib/weekMath'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function HelocMonthView() {
  const now = new Date()
  const [settings, setSettings] = useState(null)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [monthRow, setMonthRow] = useState(null)
  const [openingBalanceInput, setOpeningBalanceInput] = useState('0')
  const [weeks, setWeeks] = useState([])
  const [bills, setBills] = useState([])
  const [pasteText, setPasteText] = useState('')
  const [importMsg, setImportMsg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadMonth = useCallback(async (m, y) => {
    setLoading(true)
    setError(null)
    try {
      const s = await getModuleSettings('heloc')
      setSettings(s)
      const existing = await getMonth('heloc', m, y)
      setMonthRow(existing)
      if (existing) {
        const [w, b] = await Promise.all([listWeeks(existing.id), listBills(existing.id)])
        setWeeks(w)
        setBills(b)
      } else {
        setWeeks([])
        setBills([])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMonth(month, year)
  }, [loadMonth, month, year])

  async function handleCreateMonth() {
    setError(null)
    try {
      const created = await createMonth({
        module: 'heloc',
        month,
        year,
        opening_balance: Number(openingBalanceInput) || 0,
      })
      setMonthRow(created)

      // Pre-create the 4 weeks with their fixed date boundaries.
      const boundaries = getWeekBoundaries(month, year)
      const created_weeks = []
      for (const b of boundaries) {
        const w = await upsertWeek({
          month_id: created.id,
          week_number: b.week_number,
          start_date: b.start_date,
          end_date: b.end_date,
          bank_checking_balance: 0,
          other_income: 0,
          transfer_completed: false,
        })
        created_weeks.push(w)
      }
      setWeeks(created_weeks)
      setBills([])
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleImport() {
    setImportMsg(null)
    setError(null)
    try {
      const { rows, errors } = parseBillsPaste(pasteText)
      if (rows.length === 0) {
        setImportMsg({ type: 'error', text: 'Nothing parsed — check the paste includes the header row.' })
        return
      }
      // Replace this month's bills so re-pasting an updated export doesn't duplicate rows.
      await deleteBillsForMonth(monthRow.id)
      const inserted = await insertBills(monthRow.id, rows)
      setBills(inserted)
      setPasteText('')
      const errText = errors.length ? ` (${errors.length} line(s) skipped — see console)` : ''
      if (errors.length) console.warn('Bill import skipped lines:', errors)
      setImportMsg({ type: 'ok', text: `Imported ${inserted.length} bill row(s).${errText}` })
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleWeekFieldChange(week, field, value) {
    const patch = { [field]: value }
    const updated = await updateWeek(week.id, patch)
    setWeeks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
  }

  // Compute all 4 weeks in order — each week's beginning balance rolls
  // forward from the prior week's ending balance unless overridden.
  const computed = useMemo(() => {
    if (!settings || !monthRow || weeks.length === 0) return []
    let priorEnding = monthRow.opening_balance
    return weeks
      .slice()
      .sort((a, b) => a.week_number - b.week_number)
      .map((w) => {
        const beginningBalance = w.beginning_balance_override ?? priorEnding
        const result = computeWeek({
          beginningBalance,
          bankCheckingBalance: w.bank_checking_balance,
          threshold: settings.threshold,
          otherIncome: w.other_income,
          bills,
          bankAccountName: settings.checking_account_name,
          helocAccountName: settings.target_account_name,
          startDate: w.start_date,
          endDate: w.end_date,
        })
        priorEnding = result.endingBalance
        return { week: w, beginningBalance, ...result }
      })
  }, [settings, monthRow, weeks, bills])

  if (loading) return <p className="dim">Loading…</p>
  if (error) return <p className="error-text">Error: {error}</p>

  return (
    <div className="heloc-view">
      <div className="month-picker">
        <label>
          Month
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ width: 90 }}
          />
        </label>
      </div>

      {!monthRow ? (
        <div className="placeholder-card">
          <span className="phase-tag">No data yet for {MONTH_NAMES[month - 1]} {year}</span>
          <h2>Create this month</h2>
          <p>Set the opening HELOC balance to start tracking {MONTH_NAMES[month - 1]} {year}.</p>
          <label className="field">
            Opening HELOC balance
            <input
              type="number"
              step="0.01"
              value={openingBalanceInput}
              onChange={(e) => setOpeningBalanceInput(e.target.value)}
            />
          </label>
          <button className="btn-primary" onClick={handleCreateMonth}>
            Create {MONTH_NAMES[month - 1]} {year}
          </button>
        </div>
      ) : (
        <>
          <section className="card">
            <h3>Import bills</h3>
            <p className="dim">
              Paste the raw tab-delimited Quicken export. Re-pasting replaces this month's bills.
            </p>
            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Status	Due	Pay To / Receive From	Payments	Deposits	Account to Use	Method"
            />
            <button className="btn-primary" onClick={handleImport} disabled={!pasteText.trim()}>
              Import
            </button>
            {importMsg && <p className={importMsg.type === 'error' ? 'error-text' : 'ok-text'}>{importMsg.text}</p>}
            <p className="dim">{bills.length} bill row(s) loaded for this month.</p>
          </section>

          {computed.map(({ week, beginningBalance, thresholdAmt, bankBills, helocBills, depositsHint, available, transfer, endingBalance }) => (
            <section className="card week-card" key={week.id}>
              <h3>
                Week {week.week_number}{' '}
                <span className="dim mono-num">
                  ({week.start_date} – {week.end_date})
                </span>
              </h3>

              <div className="week-grid">
                <label className="field">
                  Beginning HELOC balance
                  <input
                    type="number"
                    step="0.01"
                    value={week.beginning_balance_override ?? beginningBalance}
                    onChange={(e) =>
                      handleWeekFieldChange(
                        week,
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
                    value={week.bank_checking_balance}
                    onChange={(e) => handleWeekFieldChange(week, 'bank_checking_balance', Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Other income
                  <input
                    type="number"
                    step="0.01"
                    value={week.other_income}
                    onChange={(e) => handleWeekFieldChange(week, 'other_income', Number(e.target.value))}
                  />
                  {depositsHint > 0 && (
                    <span className="hint">Import shows {money(depositsHint)} in deposits this week</span>
                  )}
                </label>
              </div>

              <dl className="week-results">
                <div><dt>Bank threshold</dt><dd className="mono-num">{money(thresholdAmt)}</dd></div>
                <div><dt>Bank bills ({settings.checking_account_name})</dt><dd className="mono-num">{money(bankBills)}</dd></div>
                <div><dt>Available funds</dt><dd className="mono-num">{money(available)}</dd></div>
                <div><dt>HELOC bills ({settings.target_account_name})</dt><dd className="mono-num">{money(helocBills)}</dd></div>
              </dl>

              <div className="transfer-row">
                <span>
                  Move <strong className="mono-num">{money(transfer.amount)}</strong> from{' '}
                  {transfer.direction === 'heloc_to_bank' ? 'HELOC → Bank' : 'Bank → HELOC'}
                </span>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={week.transfer_completed}
                    onChange={(e) => handleWeekFieldChange(week, 'transfer_completed', e.target.checked)}
                  />
                  Completed
                </label>
              </div>

              <p className="ending-balance">
                HELOC balance after Week {week.week_number}: <span className="mono-num">{money(endingBalance)}</span>
              </p>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
