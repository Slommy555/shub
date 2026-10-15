import { useState } from 'react'
import type { FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { GoldDivider } from '../components/ui/GoldDivider'
import { requestMagicLink } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
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

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-8">
      <div className="w-full max-w-[320px]">
        <h1 className="text-center font-display text-[64px] font-extrabold leading-none tracking-[0.08em] text-gold">LIFT</h1>
        <GoldDivider className="my-10" />

        {state === 'sent' ? (
          <div className="flex flex-col items-center text-center">
            <MailCheck size={40} strokeWidth={1.25} className="text-gold" />
            <p className="mt-4 text-[14px] text-ink">Check your inbox</p>
            <p className="mt-1 font-mono text-[12px] text-ink-2">{email}</p>
            <button onClick={() => setState('idle')} className="mt-6 text-[12px] uppercase tracking-[0.14em] text-ink-2 hover:text-ink">
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
              {state === 'sending' ? 'Sending…' : 'Send link'}
            </Button>
            {error && <p className="pt-1 text-center text-[13px] text-danger">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
