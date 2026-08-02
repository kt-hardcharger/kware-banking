import { useState } from 'react'

const emptyManualTxn = { txn_date: '', description: '', amount: '', type: 'Charge' }

const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function CcImportTab({ cc }) {
  const { transactions, importTransactions, addManualTransaction, deleteTransactionRow } = cc
  const [csvText, setCsvText] = useState('')
  const [importMsg, setImportMsg] = useState(null)
  const [manualTxn, setManualTxn] = useState(emptyManualTxn)
  const [manualMsg, setManualMsg] = useState(null)
  const [error, setError] = useState(null)

  function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result ?? ''))
    reader.readAsText(file)
    e.target.value = '' // allow re-picking the same file later
  }

  async function handleImport() {
    setImportMsg(null)
    setError(null)
    try {
      const { insertedCount, errors, nothingParsed } = await importTransactions(csvText)
      if (nothingParsed) {
        setImportMsg({ type: 'error', text: 'Nothing parsed — check the CSV includes the header row.' })
        return
      }
      setCsvText('')
      const errText = errors.length ? ` (${errors.length} line(s) skipped — see console)` : ''
      if (errors.length) console.warn('CC import skipped lines:', errors)
      setImportMsg({ type: 'ok', text: `Imported ${insertedCount} transaction(s).${errText}` })
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleAddManualTxn(e) {
    e.preventDefault()
    setManualMsg(null)
    setError(null)

    const amountNum = Number(manualTxn.amount)
    if (!manualTxn.txn_date || !manualTxn.description.trim() || !amountNum) {
      setManualMsg({ type: 'error', text: 'Fill in date, description, and amount.' })
      return
    }

    const signedAmount = manualTxn.type === 'Charge' ? Math.abs(amountNum) : -Math.abs(amountNum)

    try {
      const inserted = await addManualTransaction({
        status: 'Manual',
        txn_date: manualTxn.txn_date,
        description: manualTxn.description.trim(),
        amount: signedAmount,
      })
      setManualTxn(emptyManualTxn)
      setManualMsg({ type: 'ok', text: `Added "${inserted.description}".` })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <section className="card">
        <h3>Import card transactions</h3>
        <p className="dim">
          Paste the raw CSV export (Status, Date, Description, Debit, Credit) or upload the file directly.
          Re-importing replaces this month's transactions.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={handleFilePick} className="file-input" />
        <textarea
          rows={6}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Status,Date,Description,Debit,Credit"
        />
        <button className="btn-primary" onClick={handleImport} disabled={!csvText.trim()}>
          Import
        </button>
        {importMsg && <p className={importMsg.type === 'error' ? 'error-text' : 'ok-text'}>{importMsg.text}</p>}
        {error && <p className="error-text">Error: {error}</p>}

        <h4 className="subheading">Add one manually</h4>
        <form className="manual-bill-form" onSubmit={handleAddManualTxn}>
          <label className="field">
            Date
            <input
              type="date"
              value={manualTxn.txn_date}
              onChange={(e) => setManualTxn((p) => ({ ...p, txn_date: e.target.value }))}
            />
          </label>
          <label className="field">
            Description
            <input
              type="text"
              value={manualTxn.description}
              onChange={(e) => setManualTxn((p) => ({ ...p, description: e.target.value }))}
              placeholder="e.g. Kroger"
            />
          </label>
          <label className="field">
            Amount
            <input
              type="number"
              step="0.01"
              min="0"
              value={manualTxn.amount}
              onChange={(e) => setManualTxn((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
            />
          </label>
          <label className="field">
            Type
            <select value={manualTxn.type} onChange={(e) => setManualTxn((p) => ({ ...p, type: e.target.value }))}>
              <option value="Charge">Charge</option>
              <option value="Credit">Credit / payment</option>
            </select>
          </label>
          <button type="submit" className="btn-secondary add-btn">
            Add
          </button>
        </form>
        {manualMsg && <p className={manualMsg.type === 'error' ? 'error-text' : 'ok-text'}>{manualMsg.text}</p>}
      </section>

      <section className="card">
        <h3>
          {transactions.length} transaction{transactions.length === 1 ? '' : 's'} this month
        </h3>
        {transactions.length === 0 ? (
          <p className="dim">Nothing imported or added yet.</p>
        ) : (
          <table className="summary-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="dim">{t.txn_date}</td>
                  <td>{t.description}</td>
                  <td className={`mono-num ${t.amount > 0 ? '' : 'ok-text'}`}>{money(t.amount)}</td>
                  <td className="dim">{t.status}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-remove"
                      onClick={() => deleteTransactionRow(t.id)}
                      aria-label={`Remove ${t.description}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
