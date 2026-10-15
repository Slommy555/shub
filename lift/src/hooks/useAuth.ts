import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return {
    session,
    user: session?.user ?? null,
    loading,
    signOut: () => supabase.auth.signOut(),
  }
}

export async function verifyEmailCode(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw new Error(error.message)
}

export async function requestMagicLink(email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('lift-magic-link', {
    body: { email, redirectTo: `${window.location.origin}/log` },
  })
  if (error) {
    // FunctionsHttpError carries the response; surface the server's message.
    const ctx = (error as { context?: Response }).context
    let msg = error.message
    try {
      const body = ctx ? await ctx.json() : null
      if (body?.error) msg = body.error
    } catch {
      /* keep default message */
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
}
