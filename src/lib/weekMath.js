// Based on the formulas in "August 2026 Velocity Banking.xlsx" (Week 1-4 tabs).
// Two formulas were corrected from the original at Kendric's request — see
// the comments on bankThreshold() and endingHelocBalance() below, and the
// README's "week math" section for the before/after.

/**
 * Splits a given month into the 4 fixed-boundary weeks:
 * 1–8, 9–14, 15–22, 23–end of month (matches the Lookups tab).
 */
export function getWeekBoundaries(month, year) {
  const lastDay = new Date(year, month, 0).getDate() // day 0 of next month = last day of this month
  const ranges = [
    [1, 8],
    [9, 14],
    [15, 22],
    [23, lastDay],
  ]
  return ranges.map(([startDay, endDay], i) => ({
    week_number: i + 1,
    start_date: isoDate(year, month, startDay),
    end_date: isoDate(year, month, endDay),
  }))
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Rounds to the nearest cent — guards against floating-point drift (e.g. 83625.62999999999). */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Cleared/Paid bills are already reflected in the account balance you enter manually, so they're excluded from the math to avoid double-counting — still imported and viewable, just not summed. */
function isSettledStatus(status) {
  const s = (status ?? '').trim().toLowerCase()
  return s === 'cleared' || s === 'paid'
}

/**
 * Amount contributed by the bank checking balance toward this week's
 * available funds, after holding back the threshold ($150).
 *   Balance below threshold  → negative (a deficit you need to cover)
 *   Balance above threshold  → positive (real surplus, available to sweep)
 * (Fixed from the original spreadsheet formula, which always reserved the
 * full distance from the threshold even when the balance was already above
 * it — Kendric asked to correct that.)
 */
export function bankThreshold(bankCheckingBalance, threshold) {
  return round2(bankCheckingBalance - threshold)
}

/**
 * Spreadsheet formula (D24 / D33):
 *   SUMIFS(Payments, Due >= weekStart, Due <= weekEnd, Account to Use = account)
 * Only sums actual payment rows (negative amounts) — deposit rows in the
 * import are excluded here; they feed "Other Income" manually instead.
 * Cleared/Paid rows are also excluded (see isSettledStatus above).
 */
export function sumBillsForAccount(bills, accountName, startDate, endDate) {
  return round2(
    bills
      .filter(
        (b) =>
          b.account_used === accountName &&
          b.amount < 0 &&
          b.due_date >= startDate &&
          b.due_date <= endDate &&
          !isSettledStatus(b.status)
      )
      .reduce((sum, b) => sum + b.amount, 0)
  )
}

/** Deposits (positive amounts) for an account in range — shown as a hint for Other Income, not auto-applied. Cleared/Paid rows excluded, same as sumBillsForAccount. */
export function sumDepositsForAccount(bills, accountName, startDate, endDate) {
  return round2(
    bills
      .filter(
        (b) =>
          b.account_used === accountName &&
          b.amount > 0 &&
          b.due_date >= startDate &&
          b.due_date <= endDate &&
          !isSettledStatus(b.status)
      )
      .reduce((sum, b) => sum + b.amount, 0)
  )
}

/** Earliest due date among an account's unsettled payment rows in the week — null if none. */
function earliestBillDueDate(bills, accountName, startDate, endDate) {
  const dates = bills
    .filter(
      (b) =>
        b.account_used === accountName &&
        b.amount < 0 &&
        b.due_date >= startDate &&
        b.due_date <= endDate &&
        !isSettledStatus(b.status)
    )
    .map((b) => b.due_date)
  return dates.length ? dates.sort()[0] : null
}

/**
 * When money needs to move INTO checking (heloc_to_bank), suggest moving it
 * by the earliest bank bill due date that week, so the transfer lands before
 * that bill needs to be covered — instead of always defaulting to the
 * week's start date. Sweeps the other direction (bank_to_heloc) aren't
 * covering a due bill, so those keep the week's start date.
 */
export function suggestMoveDate({ direction, bills, bankAccountName, startDate, endDate }) {
  if (direction !== 'heloc_to_bank') return startDate
  return earliestBillDueDate(bills, bankAccountName, startDate, endDate) ?? startDate
}
export function availableFunds(threshold, bankBills, otherIncome) {
  return round2(threshold + bankBills + otherIncome)
}

/**
 * Spreadsheet formula (B36/D36):
 * Available Funds <= 0 → move that shortfall from HELOC to Bank.
 * Available Funds > 0  → sweep the surplus from Bank to HELOC.
 */
export function transferInstruction(available) {
  return {
    direction: available <= 0 ? 'heloc_to_bank' : 'bank_to_heloc',
    amount: round2(Math.abs(available)),
  }
}

/**
 * End-of-week HELOC balance = beginning balance, plus debt from bills paid
 * directly on the HELOC this week, plus/minus the sweep transfer:
 *   HELOC → Bank sweep  → increases HELOC debt by the transfer amount
 *   Bank → HELOC sweep  → decreases HELOC debt by the transfer amount
 * (Fixed from the original spreadsheet, which left direct HELOC bills out
 * of this total — Kendric asked to correct that.)
 */
export function endingHelocBalance(beginningBalance, helocBills, transfer) {
  const directBillsDebt = -helocBills // helocBills is <= 0 (payments), so this is the positive debt added
  const transferEffect = transfer.direction === 'heloc_to_bank' ? transfer.amount : -transfer.amount
  return round2(beginningBalance + directBillsDebt + transferEffect)
}

/**
 * Full week calculation, bundled. `beginningBalance` is either the manual
 * override for week 1 of a month, or the prior week's ending balance.
 */
export function computeWeek({
  beginningBalance,
  bankCheckingBalance,
  threshold,
  otherIncome,
  bills,
  bankAccountName,
  helocAccountName,
  startDate,
  endDate,
}) {
  const thresholdAmt = bankThreshold(bankCheckingBalance, threshold)
  const bankBills = sumBillsForAccount(bills, bankAccountName, startDate, endDate)
  const helocBills = sumBillsForAccount(bills, helocAccountName, startDate, endDate)
  const depositsHint = sumDepositsForAccount(bills, bankAccountName, startDate, endDate)
  const available = availableFunds(thresholdAmt, bankBills, otherIncome)
  const transfer = transferInstruction(available)
  const endingBalance = endingHelocBalance(beginningBalance, helocBills, transfer)
  const moveDate = suggestMoveDate({ direction: transfer.direction, bills, bankAccountName, startDate, endDate })

  return {
    thresholdAmt,
    bankBills,
    helocBills,
    depositsHint,
    available,
    transfer,
    endingBalance,
    moveDate,
  }
}

/**
 * Runs computeWeek() across all 4 weeks of a month in order, chaining each
 * week's ending balance into the next week's beginning balance (unless a
 * week has a manual override). Shared by the on-screen calc and the New
 * Month carry-forward suggestion so they can never drift apart.
 */
export function computeAllWeeks({ settings, monthRow, weeks, bills }) {
  if (!settings || !monthRow || weeks.length === 0) return []
  let priorEnding = round2(monthRow.opening_balance)
  return weeks
    .slice()
    .sort((a, b) => a.week_number - b.week_number)
    .map((w) => {
      const beginningBalance = round2(w.beginning_balance_override ?? priorEnding)
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
}
