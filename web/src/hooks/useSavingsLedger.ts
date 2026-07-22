import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type LedgerKind = 'in' | 'out';

export interface LedgerEntry {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  kind: LedgerKind;
  amount: number;
  note: string;
  created_at?: string;
}

/** Chronological sort: by date, then insertion order. */
const byWhen = (a: LedgerEntry, b: LedgerEntry) => {
  if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
  return (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1;
};

/**
 * A standalone savings ledger for the Savings tab: dated money-in (put away) and
 * money-out (payments). Exposes totals, the current balance, and a per-entry
 * running balance. Optimistic writes, realtime-synced; RLS scopes to the user.
 */
export function useSavingsLedger(userId: string | null) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<LedgerEntry[]>([]);
  ref.current = entries;

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('savings_ledger')
        .select('*')
        .eq('user_id', userId)
        .order('entry_date', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('load savings ledger failed:', error.message);
        setLoading(false);
        return;
      }
      setEntries(((data as LedgerEntry[]) ?? []).sort(byWhen));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`savings_ledger-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_ledger', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setEntries((prev) => prev.filter((e) => e.id !== id));
            return;
          }
          const row = payload.new as LedgerEntry;
          setEntries((prev) => {
            const exists = prev.some((e) => e.id === row.id);
            return (exists ? prev.map((e) => (e.id === row.id ? row : e)) : [...prev, row]).sort(byWhen);
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addEntry = useCallback(
    async (kind: LedgerKind, amount: number, entryDate: string, note: string) => {
      if (!userId) return;
      const value = Math.max(0, amount);
      if (!(value > 0) || !entryDate) return;
      const id = crypto.randomUUID();
      const row: LedgerEntry = {
        id,
        user_id: userId,
        entry_date: entryDate,
        kind,
        amount: value,
        note: note.trim(),
        created_at: new Date().toISOString(),
      };
      setEntries((prev) => [...prev, row].sort(byWhen));
      const { error } = await supabase
        .from('savings_ledger')
        .insert({ id, user_id: userId, entry_date: entryDate, kind, amount: value, note: note.trim() });
      if (error) console.error('addEntry failed:', error.message);
    },
    [userId]
  );

  const deleteEntry = useCallback(async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('savings_ledger').delete().eq('id', id);
    if (error) console.error('deleteEntry failed:', error.message);
  }, []);

  const { totalIn, totalOut, runningBalance } = useMemo(() => {
    let tin = 0;
    let tout = 0;
    const running: Record<string, number> = {};
    let bal = 0;
    for (const e of entries) {
      const amt = Number(e.amount) || 0;
      if (e.kind === 'in') {
        tin += amt;
        bal += amt;
      } else {
        tout += amt;
        bal -= amt;
      }
      running[e.id] = bal;
    }
    return { totalIn: tin, totalOut: tout, runningBalance: running };
  }, [entries]);

  return {
    entries,
    loading,
    addEntry,
    deleteEntry,
    totalIn,
    totalOut,
    balance: totalIn - totalOut,
    runningBalance,
  };
}

export type UseSavingsLedger = ReturnType<typeof useSavingsLedger>;
