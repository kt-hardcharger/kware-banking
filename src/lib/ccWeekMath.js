// Credit Card module weekly math. Structurally the same shape as
// src/lib/weekMath.js: sweep money between Checking and the target debt
// account (the credit card here, the HELOC there), holding back a $150
// threshold. Unlike the HELOC module, this week's card charges (from the
// imported CSV) are shown for reference only and do not feed the ending
// balance — only the sweep transfer does.

import { bankThreshold, availableFunds } from './weekMath'

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** This week's charges (positive amounts only — credits/payments on the statement are excluded, since the app's own computed transfer already accounts for money moved to the card). */
export function sumChargesInRange(transactions, startDate, endDate) {
  return round2(
    transactions
      .filter((t) => t.amount > 0 && t.txn_date >= startDate && t.txn_date <= endDate)
      .reduce((sum, t) => sum + t.amount, 0)
  )
}

/**
 * Available Funds <= 0 → checking is short, pull that amount from the card
 *                        back into checking (increases card debt).
 * Available Funds > 0  → sweep the surplus onto the card (pays it down).
 */
export function ccTransferInstruction(available) {
  return {
    direction: available <= 0 ? 'cc_to_bank' : 'bank_to_cc',
    amount: round2(Math.abs(available)),
  }
}

/**
 * End-of-week card balance = beginning balance, plus/minus the sweep
 * transfer only. "Card spend this week" is shown for reference but does
 * not feed into this — Kendric asked to keep those separate.
 */
export function endingCcBalance(beginningBalance, transfer) {
  const transferEffect = transfer.direction === 'cc_to_bank' ? transfer.amount : -transfer.amount
  return round2(beginningBalance + transferEffect)
}

export function computeCcWeek({
  beginningBalance,
  bankCheckingBalance,
  threshold,
  otherIncome,
  transactions,
  startDate,
  endDate,
}) {
  const thresholdAmt = bankThreshold(bankCheckingBalance, threshold)
  const weekSpend = sumChargesInRange(transactions, startDate, endDate)
  const available = availableFunds(thresholdAmt, 0, otherIncome) // no bills for this module
  const transfer = ccTransferInstruction(available)
  const endingBalance = endingCcBalance(beginningBalance, transfer)

  return { thresholdAmt, weekSpend, available, transfer, endingBalance }
}

/**
 * Runs computeCcWeek() across all 4 weeks of a month in order, chaining
 * ending balance into the next week's beginning balance unless overridden —
 * same pattern as computeAllWeeks() in weekMath.js.
 */
export function computeAllCcWeeks({ settings, monthRow, weeks, transactions }) {
  if (!settings || !monthRow || weeks.length === 0) return []
  let priorEnding = round2(monthRow.opening_balance)
  return weeks
    .slice()
    .sort((a, b) => a.week_number - b.week_number)
    .map((w) => {
      const beginningBalance = round2(w.beginning_balance_override ?? priorEnding)
      const result = computeCcWeek({
        beginningBalance,
        bankCheckingBalance: w.bank_checking_balance,
        threshold: settings.threshold,
        otherIncome: w.other_income,
        transactions,
        startDate: w.start_date,
        endDate: w.end_date,
      })
      priorEnding = result.endingBalance
      return { week: w, beginningBalance, ...result }
    })
}
