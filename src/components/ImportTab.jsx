import { useMemo, useState } from 'react'

const emptyManualBill = { due_date: '', payee: '', amount: '', account_used: '', type: 'Payment' }

const money = (n) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function toEditDraft(b) {
  return {
    due_date: b.due_date,
    payee: b.payee,
    amount: String(Math.abs(b.amount)),
    type: b.amount < 0 ? 'Payment' : 'Deposit',
    account_used: b.account_used,
    status: b.status ?? '',
  }
}

export default function ImportTab({ heloc }) {
  const { settings, bills, importBills, addManualBill, deleteBillRow, updateBillRow } = heloc
  const [pasteText, setPasteText] = useState('')
  const [importMsg, setImportMsg] = useState(null)
  const [manualBill, setManualBill] = useState(() => ({
    ...emptyManualBill,
    account_used: settings?.checking_account_name ?? '',
  }))
  const [manualMsg, setManualMsg] = useState(null)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  const statusOptions = useMemo(() => {
    const set = new Set(bills.map((b) => b.status).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [bills])

  const filteredBills = useMemo(
    () => (statusFilter === 'All' ? bills : bills.filter((b) => b.status === statusFilter)),
    [bills, statusFilter]
  )

  async function handleImport() {
    setImportMsg(null)
    setError(null)
    try {
      const { insertedCount, errors, nothingParsed } = await importBills(pasteText)
      if (nothingParsed) {
        setImportMsg({ type: 'error', text: 'Nothing parsed — check the paste includes the header row.' })
        return
      }
      setPasteText('')
      const errText = errors.length ? ` (${errors.length} line(s) skipped — see console)` : ''
      if (errors.length) console.warn('Bill import skipped lines:', errors)
      setImportMsg({ type: 'ok', text: `Imported ${insertedCount} bill row(s).${errText}` })
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleAddManualBill(e) {
    e.preventDefault()
    setManualMsg(null)
    setError(null)

    const amountNum = Number(manualBill.amount)
    if (!manualBill.due_date || !manualBill.payee.trim() || !manualBill.account_used || !amountNum) {
      setManualMsg({ type: 'error', text: 'Fill in date, payee, amount, and account.' })
      return
    }

    const signedAmount = manualBill.type === 'Payment' ? -Math.abs(amountNum) : Math.abs(amountNum)

    try {
      const inserted = await addManualBill({
        status: 'Manual',
        due_date: manualBill.due_date,
        payee: manualBill.payee.trim(),
        amount: signedAmount,
        account_used: manualBill.account_used,
        method: manualBill.type,
      })
      setManualBill((prev) => ({ ...emptyManualBill, account_used: prev.account_used }))
      setManualMsg({ type: 'ok', text: `Added "${inserted.payee}".` })
    } catch (e) {
      setError(e.message)
    }
  }

  function startEdit(b) {
    setEditingId(b.id)
    setEditDraft(toEditDraft(b))
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(null)
  }

  async function saveEdit(id) {
    setError(null)
    const amountNum = Number(editDraft.amount)
    if (!editDraft.due_date || !editDraft.payee.trim() || !editDraft.account_used || !amountNum) {
      setError('Fill in date, payee, amount, and account.')
      return
    }
    const signedAmount = editDraft.type === 'Payment' ? -Math.abs(amountNum) : Math.abs(amountNum)
    try {
      await updateBillRow(id, {
        due_date: editDraft.due_date,
        payee: editDraft.payee.trim(),
        amount: signedAmount,
        account_used: editDraft.account_used,
        status: editDraft.status.trim() || null,
      })
      setEditingId(null)
      setEditDraft(null)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <section className="card">
        <h3>Import bills or income</h3>
        <p className="dim">Paste the raw tab-delimited Quicken export. Re-pasting replaces this month's bills.</p>
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
        {error && <p className="error-text">Error: {error}</p>}

        <h4 className="subheading">Add one manually</h4>
        <form className="manual-bill-form" onSubmit={handleAddManualBill}>
          <label className="field">
            Due date
            <input
              type="date"
              value={manualBill.due_date}
              onChange={(e) => setManualBill((p) => ({ ...p, due_date: e.target.value }))}
            />
          </label>
          <label className="field">
            Payee
            <input
              type="text"
              value={manualBill.payee}
              onChange={(e) => setManualBill((p) => ({ ...p, payee: e.target.value }))}
              placeholder="e.g. Netflix"
            />
          </label>
          <label className="field">
            Amount
            <input
              type="number"
              step="0.01"
              min="0"
              value={manualBill.amount}
              onChange={(e) => setManualBill((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
            />
          </label>
          <label className="field">
            Type
            <select value={manualBill.type} onChange={(e) => setManualBill((p) => ({ ...p, type: e.target.value }))}>
              <option value="Payment">Payment</option>
              <option value="Deposit">Deposit (income)</option>
            </select>
          </label>
          <label className="field">
            Account
            <select
              value={manualBill.account_used}
              onChange={(e) => setManualBill((p) => ({ ...p, account_used: e.target.value }))}
            >
              {settings && <option value={settings.checking_account_name}>{settings.checking_account_name}</option>}
              {settings && <option value={settings.target_account_name}>{settings.target_account_name}</option>}
            </select>
          </label>
          <button type="submit" className="btn-secondary add-btn">
            Add
          </button>
        </form>
        {manualMsg && <p className={manualMsg.type === 'error' ? 'error-text' : 'ok-text'}>{manualMsg.text}</p>}
      </section>

      <section className="card">
        <div className="list-header">
          <h3>
            {filteredBills.length} of {bills.length} bill/income row{bills.length === 1 ? '' : 's'} this month
          </h3>
          <label className="filter-field">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        {bills.length === 0 ? (
          <p className="dim">Nothing imported or added yet.</p>
        ) : (
          <table className="summary-table">
            <thead>
              <tr>
                <th>Due</th>
                <th>Payee</th>
                <th>Amount</th>
                <th>Account</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((b) =>
                editingId === b.id ? (
                  <tr key={b.id} className="editing-row">
                    <td>
                      <input
                        type="date"
                        value={editDraft.due_date}
                        onChange={(e) => setEditDraft((d) => ({ ...d, due_date: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editDraft.payee}
                        onChange={(e) => setEditDraft((d) => ({ ...d, payee: e.target.value }))}
                      />
                    </td>
                    <td>
                      <div className="edit-amount-group">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editDraft.amount}
                          onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                        />
                        <select
                          value={editDraft.type}
                          onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value }))}
                        >
                          <option value="Payment">Payment</option>
                          <option value="Deposit">Deposit</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      <select
                        value={editDraft.account_used}
                        onChange={(e) => setEditDraft((d) => ({ ...d, account_used: e.target.value }))}
                      >
                        {settings && (
                          <option value={settings.checking_account_name}>{settings.checking_account_name}</option>
                        )}
                        {settings && (
                          <option value={settings.target_account_name}>{settings.target_account_name}</option>
                        )}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editDraft.status}
                        onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value }))}
                        placeholder="e.g. Cleared"
                      />
                    </td>
                    <td className="edit-actions">
                      <button type="button" className="btn-secondary btn-tiny" onClick={() => saveEdit(b.id)}>
                        Save
                      </button>
                      <button type="button" className="btn-secondary btn-tiny" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={b.id}>
                    <td className="dim">{b.due_date}</td>
                    <td>{b.payee}</td>
                    <td className={`mono-num ${b.amount < 0 ? '' : 'ok-text'}`}>{money(b.amount)}</td>
                    <td className="dim">{b.account_used}</td>
                    <td className="dim">{b.status}</td>
                    <td className="edit-actions">
                      <button type="button" className="btn-edit" onClick={() => startEdit(b)} aria-label={`Edit ${b.payee}`}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => deleteBillRow(b.id)}
                        aria-label={`Remove ${b.payee}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
