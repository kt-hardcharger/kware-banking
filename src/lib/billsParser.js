// Parses the raw tab-delimited Quicken "Bill and Income Reminders" export
// (see August 2026 Bills.txt) into plain bill rows ready to insert.
//
// Expected columns, in order, once the header row is found:
//   Status | Due | Pay To / Receive From | Payments | Deposits | Account to Use | Method
//
// Payments and Deposits are mutually exclusive per row — we combine them into
// a single signed `amount` (negative = payment, positive = deposit), same
// convention the spreadsheet's SUMIFS formulas rely on.

function parseAmount(raw) {
  if (!raw) return null
  const cleaned = raw.replace(/[$,]/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isNaN(n) ? null : n
}

function parseDate(raw) {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, mm, dd, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

export function parseBillsPaste(text) {
  const lines = text.split(/\r?\n/)

  const headerIdx = lines.findIndex(
    (line) => line.includes('Status') && line.includes('Due') && line.includes('Pay To')
  )

  if (headerIdx === -1) {
    throw new Error(
      "Couldn't find the header row (Status / Due / Pay To / Receive From / Payments / Deposits / Account to Use / Method). Paste the raw export unmodified."
    )
  }

  const rows = []
  const errors = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue

    const cols = line.split('\t').map((c) => c.trim())
    if (cols.length < 6) continue // stray/blank trailing lines

    const [status, dueRaw, payee, paymentsRaw, depositsRaw, accountUsed, method] = cols

    const due_date = parseDate(dueRaw)
    if (!due_date) {
      errors.push(`Line ${i + 1}: couldn't parse date "${dueRaw}"`)
      continue
    }

    const payment = parseAmount(paymentsRaw)
    const deposit = parseAmount(depositsRaw)
    const amount = payment !== null ? payment : deposit

    if (amount === null) {
      errors.push(`Line ${i + 1}: no amount in Payments or Deposits for "${payee}"`)
      continue
    }
    if (!accountUsed) {
      errors.push(`Line ${i + 1}: missing "Account to Use" for "${payee}"`)
      continue
    }

    rows.push({
      status: status || null,
      due_date,
      payee: payee || '(unlabeled)',
      amount,
      account_used: accountUsed,
      method: method || (amount < 0 ? 'Payment' : 'Deposit'),
    })
  }

  return { rows, errors }
}
