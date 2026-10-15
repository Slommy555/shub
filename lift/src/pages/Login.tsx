import { useState } from 'react'
import type { FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { GoldDivider } from '../components/ui/GoldDivider'
import { requestMagicLink, verifyEmailCode } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'verifying'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    setError(null)
    try {
      await requestMagicLink(email.trim())
      setState('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send link')
      setState('idle')
    }
  }

  // Installed PWAs can't receive the link (it opens in the browser), so the
  // code from the same email is entered here instead.
  async function verify(e: FormEvent) {
    e.preventDefault()
    setState('verifying')
    setError(null)
    try {
      await verifyEmailCode(email.trim(), code)
      // useAuth picks up the new session and routes to /log.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code')
      setState('sent')
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-8">
      <div className="w-full max-w-[320px]">
        <h1 className="text-center font-display text-[64px] font-extrabold leading-none tracking-[0.08em] text-gold">LIFT</h1>
        <GoldDivider className="my-10" />

        {state === 'sent' || state === 'verifying' ? (
          <div className="flex flex-col items-center text-center">
            <MailCheck size={40} strokeWidth={1.25} className="text-gold" />
            <p className="mt-4 text-[14px] text-ink">Enter the code from your email</p>
            <p className="mt-1 font-mono text-[12px] text-ink-2">{email}</p>
            <form onSubmit={verify} className="mt-6 w-full space-y-3">
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                className="field text-center font-mono text-[22px] tracking-[0.4em]"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <Button type="submit" full size="lg" disabled={state === 'verifying' || code.length < 6}>
                {state === 'verifying' ? 'Verifying…' : 'Sign in'}
              </Button>
            </form>
            {error && <p className="pt-3 text-center text-[13px] text-danger">{error}</p>}
            <button
              onClick={() => {
                setState('idle')
                setCode('')
                setError(null)
              }}
              className="mt-6 text-[12px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink"
            >
              Use another email
            </button>
          </div>
        ) : (
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
            <Button type="submit" full size="lg" disabled={state === 'sending' || !email}>
              {state === 'sending' ? 'Sending…' : 'Send code'}
            </Button>
            {error && <p className="pt-1 text-center text-[13px] text-danger">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
