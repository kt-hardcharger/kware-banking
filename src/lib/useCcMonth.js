import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getModuleSettings,
  getMonth,
  createMonth,
  listMonths,
  listWeeks,
  upsertWeek,
  updateWeek,
  listCcTransactions,
  insertCcTransactions,
  deleteCcTransaction,
  deleteCcTransactionsForMonth,
} from './db'
import { parseCcCsv } from './ccCsvParser'
import { getWeekBoundaries } from './weekMath'
import { computeAllCcWeeks } from './ccWeekMath'
import { MONTH_NAMES } from './useHelocMonth'

const MODULE = 'credit_card'

function nextMonthYear(month, year) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year }
}

export function useCcMonth() {
  const now = new Date()
  const [settings, setSettings] = useState(null)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [monthRow, setMonthRow] = useState(null)
  const [monthsList, setMonthsList] = useState([])
  const [openingBalanceInput, setOpeningBalanceInput] = useState('0')
  const [carryForwardNote, setCarryForwardNote] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadMonth = useCallback(async (m, y) => {
    setLoading(true)
    setError(null)
    try {
      const s = await getModuleSettings(MODULE)
      setSettings(s)
      const [existing, months] = await Promise.all([getMonth(MODULE, m, y), listMonths(MODULE)])
      setMonthRow(existing)
      setMonthsList(months)
      if (existing) {
        const [w, t] = await Promise.all([listWeeks(existing.id), listCcTransactions(existing.id)])
        setWeeks(w)
        setTransactions(t)
      } else {
        setWeeks([])
        setTransactions([])
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
  // and — if that prior month has data — suggests its computed ending
  // card balance as the new month's opening balance (still editable).
  async function handleNewMonth() {
    setError(null)
    setCarryForwardNote(null)

    const latest = monthsList[0] // listMonths() sorts newest first
    const base = latest ?? { month, year }
    const next = nextMonthYear(base.month, base.year)

    let suggested = 0
    if (latest) {
      try {
        const [s, w, t] = await Promise.all([
          getModuleSettings(MODULE),
          listWeeks(latest.id),
          listCcTransactions(latest.id),
        ])
        const chain = computeAllCcWeeks({ settings: s, monthRow: latest, weeks: w, transactions: t })
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
    const created = await createMonth({
      module: MODULE,
      month,
      year,
      opening_balance: Number(openingBalanceInput) || 0,
    })
    setMonthRow(created)
    setMonthsList((prev) => [created, ...prev])

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
    setTransactions([])
  }

  async function importTransactions(csvText) {
    const { rows, errors } = parseCcCsv(csvText)
    if (rows.length === 0) {
      return { insertedCount: 0, errors, nothingParsed: true }
    }
    // Replace this month's transactions so re-pasting an updated export doesn't duplicate rows.
    await deleteCcTransactionsForMonth(monthRow.id)
    const inserted = await insertCcTransactions(monthRow.id, rows)
    setTransactions(inserted)
    return { insertedCount: inserted.length, errors, nothingParsed: false }
  }

  async function addManualTransaction(fields) {
    const [inserted] = await insertCcTransactions(monthRow.id, [fields])
    setTransactions((prev) => [...prev, inserted].sort((a, b) => (a.txn_date < b.txn_date ? -1 : 1)))
    return inserted
  }

  async function deleteTransactionRow(id) {
    await deleteCcTransaction(id)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
  }

  async function handleWeekFieldChange(week, field, value) {
    const patch = { [field]: value }
    const updated = await updateWeek(week.id, patch)
    setWeeks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
  }

  const computed = useMemo(
    () => computeAllCcWeeks({ settings, monthRow, weeks, transactions }),
    [settings, monthRow, weeks, transactions]
  )

  const sortedTransactions = useMemo(
    () => transactions.slice().sort((a, b) => (a.txn_date < b.txn_date ? -1 : 1)),
    [transactions]
  )

  return {
    settings,
    month,
    year,
    monthRow,
    monthsList,
    openingBalanceInput,
    setOpeningBalanceInput,
    carryForwardNote,
    weeks,
    transactions: sortedTransactions,
    computed,
    loading,
    error,
    handlePickExistingMonth,
    handleNewMonth,
    handleCreateMonth,
    handleWeekFieldChange,
    importTransactions,
    addManualTransaction,
    deleteTransactionRow,
  }
}
