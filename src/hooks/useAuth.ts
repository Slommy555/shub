import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

/**
 * Tracks the Supabase auth session. The session is persisted by the client
 * (see lib/supabase.ts) so it survives page reloads.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ session: data.session, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setState({ session, loading: false });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /** Sign in with email + password. */
  async function signInWithPassword(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  /** Set or change the password on the currently signed-in account. */
  async function setPassword(password: string) {
    return supabase.auth.updateUser({ password });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return {
    session: state.session,
    user: state.session?.user ?? null,
    loading: state.loading,
    signInWithPassword,
    setPassword,
    signOut,
  };
}
