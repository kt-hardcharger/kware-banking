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
  deleteBill,
  deleteBillsForMonth,
} from './db'
import { parseBillsPaste } from './billsParser'
import { getWeekBoundaries, computeAllWeeks } from './weekMath'

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function nextMonthYear(month, year) {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year }
}

export function useHelocMonth() {
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
  }

  async function importBills(pasteText) {
    const { rows, errors } = parseBillsPaste(pasteText)
    if (rows.length === 0) {
      return { insertedCount: 0, errors, nothingParsed: true }
    }
    // Replace this month's bills so re-pasting an updated export doesn't duplicate rows.
    await deleteBillsForMonth(monthRow.id)
    const inserted = await insertBills(monthRow.id, rows)
    setBills(inserted)
    return { insertedCount: inserted.length, errors, nothingParsed: false }
  }

  async function addManualBill(fields) {
    const [inserted] = await insertBills(monthRow.id, [fields])
    setBills((prev) => [...prev, inserted].sort((a, b) => (a.due_date < b.due_date ? -1 : 1)))
    return inserted
  }

  async function deleteBillRow(id) {
    await deleteBill(id)
    setBills((prev) => prev.filter((b) => b.id !== id))
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

  const sortedBills = useMemo(() => bills.slice().sort((a, b) => (a.due_date < b.due_date ? -1 : 1)), [bills])

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
    bills: sortedBills,
    computed,
    loading,
    error,
    handlePickExistingMonth,
    handleNewMonth,
    handleCreateMonth,
    handleWeekFieldChange,
    importBills,
    addManualBill,
    deleteBillRow,
  }
}
