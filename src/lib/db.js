import { supabase } from './supabaseClient'

export async function getModuleSettings(module) {
  const { data, error } = await supabase
    .from('module_settings')
    .select('*')
    .eq('module', module)
    .single()
  if (error) throw error
  return data
}

export async function getMonth(module, month, year) {
  const { data, error } = await supabase
    .from('months')
    .select('*')
    .eq('module', module)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listMonths(module) {
  const { data, error } = await supabase
    .from('months')
    .select('*')
    .eq('module', module)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return data
}

export async function createMonth({ module, month, year, opening_balance }) {
  const { data, error } = await supabase
    .from('months')
    .insert({ module, month, year, opening_balance })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listWeeks(monthId) {
  const { data, error } = await supabase
    .from('weeks')
    .select('*')
    .eq('month_id', monthId)
    .order('week_number', { ascending: true })
  if (error) throw error
  return data
}

export async function upsertWeek(week) {
  const { data, error } = await supabase
    .from('weeks')
    .upsert(week, { onConflict: 'month_id,week_number' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWeek(id, patch) {
  const { data, error } = await supabase.from('weeks').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function listBills(monthId) {
  const { data, error } = await supabase
    .from('bills')
    .select('*')
    .eq('month_id', monthId)
    .order('due_date', { ascending: true })
  if (error) throw error
  return data
}

export async function insertBills(monthId, rows) {
  if (rows.length === 0) return []
  const payload = rows.map((r) => ({ ...r, month_id: monthId }))
  const { data, error } = await supabase.from('bills').insert(payload).select()
  if (error) throw error
  return data
}

export async function deleteBill(id) {
  const { error } = await supabase.from('bills').delete().eq('id', id)
  if (error) throw error
}

export async function updateBill(id, patch) {
  const { data, error } = await supabase.from('bills').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteBillsForMonth(monthId) {
  const { error } = await supabase.from('bills').delete().eq('month_id', monthId)
  if (error) throw error
}

export async function listCcTransactions(monthId) {
  const { data, error } = await supabase
    .from('cc_transactions')
    .select('*')
    .eq('month_id', monthId)
    .order('txn_date', { ascending: true })
  if (error) throw error
  return data
}

export async function insertCcTransactions(monthId, rows) {
  if (rows.length === 0) return []
  const payload = rows.map((r) => ({ ...r, month_id: monthId }))
  const { data, error } = await supabase.from('cc_transactions').insert(payload).select()
  if (error) throw error
  return data
}

export async function deleteCcTransaction(id) {
  const { error } = await supabase.from('cc_transactions').delete().eq('id', id)
  if (error) throw error
}

export async function deleteCcTransactionsForMonth(monthId) {
  const { error } = await supabase.from('cc_transactions').delete().eq('month_id', monthId)
  if (error) throw error
}
