import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getModuleSettings,
  getMonth,
  createMonth,
  listMonths,
  listWeeks,
  upsertWeek,
  updateWeek,
  listBills,
  insertBills,
  deleteBillsForMonth,
} from '../lib/db'
import { parseBillsPaste } from '../lib/billsParser'
import { getWeekBoundaries, computeAllWeeks } from '../lib/weekMath'
import { buildGoogleCalendarUrl } from '../lib/googleCalendar'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function nextMonthYear(month, year) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year }
}

export default function HelocMonthView() {
  const now = new Date()
  const [settings, setSettings] = useState(null)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [monthRow, setMonthRow] = useState(null)
  const [monthsList, setMonthsList] = useState([])
  const [openingBalanceInput, setOpeningBalanceInput] = useState('0')
  const [carryForwardNote, setCarryForwardNote] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [bills, setBills] = useState([])
  const [activeWeekNum, setActiveWeekNum] = useState(1)
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
      const [existing, months] = await Promise.all([getMonth('heloc', m, y), listMonths('heloc')])
      setMonthRow(existing)
      setMonthsList(months)
      setActiveWeekNum(1)
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

  function handlePickExistingMonth(monthId) {
    const m = monthsList.find((row) => row.id === monthId)
    if (!m) return
    setCarryForwardNote(null)
    setMonth(m.month)
    setYear(m.year)
  }

  // "New Month": figures out the month after the most recent one on file,
  // and — if that prior month has HELOC data — suggests its computed
  // ending balance as the new month's opening balance (still editable).
  async function handleNewMonth() {
    setError(null)
    setCarryForwardNote(null)

    const latest = monthsList[0] // listMonths() sorts newest first
    const base = latest ?? { month, year }
    const next = nextMonthYear(base.month, base.year)

    let suggested = 0
    if (latest) {
      try {
        const [s, w, b] = await Promise.all([
          getModuleSettings('heloc'),
          listWeeks(latest.id),
          listBills(latest.id),
        ])
        const chain = computeAllWeeks({ settings: s, monthRow: latest, weeks: w, bills: b })
        if (chain.length > 0) {
          suggested = chain[chain.length - 1].endingBalance
          setCarryForwardNote(
            `Carried forward from ${MONTH_NAMES[latest.month - 1]} ${latest.year}'s ending balance.`
          )
        }
      } catch (e) {
        setError(e.message)
      }
    }

    setOpeningBalanceInput(String(suggested))
    setMonth(next.month)
    setYear(next.year)
  }

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
      setMonthsList((prev) => [created, ...prev])

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
  const computed = useMemo(
    () => computeAllWeeks({ settings, monthRow, weeks, bills }),
    [settings, monthRow, weeks, bills]
  )

  const active = computed.find((c) => c.week.week_number === activeWeekNum)

  if (loading) return <p className="dim">Loading…</p>
  if (error) return <p className="error-text">Error: {error}</p>

  return (
    <div className="heloc-view">
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

      {!monthRow ? (
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
                </label>
                <label className="field">
                  Other income
                  <input
                    type="number"
                    step="0.01"
                    value={active.week.other_income}
                    onChange={(e) => handleWeekFieldChange(active.week, 'other_income', Number(e.target.value))}
                  />
                  {active.depositsHint > 0 && (
                    <span className="hint">Import shows {money(active.depositsHint)} in deposits this week</span>
                  )}
                </label>
              </div>

              <dl className="week-results">
                <div><dt>Bank threshold</dt><dd className="mono-num">{money(active.thresholdAmt)}</dd></div>
                <div><dt>Bank bills ({settings.checking_account_name})</dt><dd className="mono-num">{money(active.bankBills)}</dd></div>
                <div><dt>Available funds</dt><dd className="mono-num">{money(active.available)}</dd></div>
                <div><dt>HELOC bills ({settings.target_account_name})</dt><dd className="mono-num">{money(active.helocBills)}</dd></div>
              </dl>

              <div className="transfer-row">
                <span>
                  Move <strong className="mono-num">{money(active.transfer.amount)}</strong> from{' '}
                  {active.transfer.direction === 'heloc_to_bank' ? 'HELOC → Bank' : 'Bank → HELOC'}
                </span>
                <div className="transfer-actions">
                  <a
                    className="btn-cal"
                    href={buildGoogleCalendarUrl({
                      title: `KWARE: Move ${money(active.transfer.amount)} ${
                        active.transfer.direction === 'heloc_to_bank' ? 'HELOC → Bank' : 'Bank → HELOC'
                      }`,
                      dateISO: active.week.start_date,
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
        </>
      )}
    </div>
  )
}
