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
  return bankCheckingBalance - threshold
}

/**
 * Spreadsheet formula (D24 / D33):
 *   SUMIFS(Payments, Due >= weekStart, Due <= weekEnd, Account to Use = account)
 * Only sums actual payment rows (negative amounts) — deposit rows in the
 * import are excluded here; they feed "Other Income" manually instead.
 */
export function sumBillsForAccount(bills, accountName, startDate, endDate) {
  return bills
    .filter(
      (b) =>
        b.account_used === accountName &&
        b.amount < 0 &&
        b.due_date >= startDate &&
        b.due_date <= endDate
    )
    .reduce((sum, b) => sum + b.amount, 0)
}

/** Deposits (positive amounts) for an account in range — shown as a hint for Other Income, not auto-applied. */
export function sumDepositsForAccount(bills, accountName, startDate, endDate) {
  return bills
    .filter(
      (b) =>
        b.account_used === accountName &&
        b.amount > 0 &&
        b.due_date >= startDate &&
        b.due_date <= endDate
    )
    .reduce((sum, b) => sum + b.amount, 0)
}

/** Spreadsheet formula (D30): Available Funds = Bank Threshold + Bank Bills + Other Income. */
export function availableFunds(threshold, bankBills, otherIncome) {
  return threshold + bankBills + otherIncome
}

/**
 * Spreadsheet formula (B36/D36):
 * Available Funds <= 0 → move that shortfall from HELOC to Bank.
 * Available Funds > 0  → sweep the surplus from Bank to HELOC.
 */
export function transferInstruction(available) {
  return {
    direction: available <= 0 ? 'heloc_to_bank' : 'bank_to_heloc',
    amount: Math.abs(available),
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
  return beginningBalance + directBillsDebt + transferEffect
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

  return {
    thresholdAmt,
    bankBills,
    helocBills,
    depositsHint,
    available,
    transfer,
    endingBalance,
  }
}
