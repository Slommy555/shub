import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { GoldDivider } from '../components/ui/GoldDivider'
import { signInWithPassword } from '../hooks/useAuth'

// Password sign-in: email links open in the browser, not the installed PWA.
// Accounts are shared with the main app on the same Supabase project.
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signInWithPassword(email.trim(), password)
      // useAuth picks up the new session and routes to /log.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-8">
      <div className="w-full max-w-[320px]">
        <h1 className="text-center font-display text-[64px] font-extrabold leading-none tracking-[0.08em] text-gold">LIFT</h1>
        <GoldDivider className="my-10" />

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            className="field text-center"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            className="field text-center"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" full size="lg" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
          {error && <p className="pt-1 text-center text-[13px] text-danger">{error}</p>}
        </form>
      </div>
    </div>
  )
}
