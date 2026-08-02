// Parses the credit card statement CSV (see Cit Card Example.CSV):
//   Status,Date,Description,Debit,Credit
// Description is quoted and can contain commas (e.g. "ONLINE PAYMENT, THANK YOU"),
// so this uses a real CSV field splitter rather than a naive comma split.

function splitCsvLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields.map((f) => f.trim())
}

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

export function parseCcCsv(text) {
  const lines = text.split(/\r?\n/)

  const headerIdx = lines.findIndex(
    (line) => line.includes('Status') && line.includes('Date') && line.includes('Description')
  )

  if (headerIdx === -1) {
    throw new Error(
      "Couldn't find the header row (Status, Date, Description, Debit, Credit). Paste the raw CSV export unmodified."
    )
  }

  const rows = []
  const errors = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue

    const cols = splitCsvLine(line)
    if (cols.length < 5) continue

    const [status, dateRaw, description, debitRaw, creditRaw] = cols

    const txn_date = parseDate(dateRaw)
    if (!txn_date) {
      errors.push(`Line ${i + 1}: couldn't parse date "${dateRaw}"`)
      continue
    }

    const debit = parseAmount(debitRaw)
    const credit = parseAmount(creditRaw)
    const amount = debit !== null ? debit : credit

    if (amount === null) {
      errors.push(`Line ${i + 1}: no amount in Debit or Credit for "${description}"`)
      continue
    }

    rows.push({
      status: status || null,
      txn_date,
      description: description || '(no description)',
      amount,
    })
  }

  return { rows, errors }
}
