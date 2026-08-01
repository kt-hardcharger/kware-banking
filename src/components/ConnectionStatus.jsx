import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Phase 1 sanity check: confirms the Supabase URL/key are wired up correctly.
// Doesn't require any tables to exist yet — auth.getSession() always resolves.
export default function ConnectionStatus() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let cancelled = false
    supabase.auth
      .getSession()
      .then(({ error }) => {
        if (cancelled) return
        setStatus(error ? 'error' : 'ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const label =
    status === 'checking'
      ? 'Connecting to Supabase…'
      : status === 'ok'
        ? 'Supabase connected'
        : 'Supabase connection failed — check .env.local'

  return (
    <span className="conn-pill">
      <span className={`conn-dot ${status === 'checking' ? '' : status === 'ok' ? 'ok' : 'err'}`} />
      {label}
    </span>
  )
}
