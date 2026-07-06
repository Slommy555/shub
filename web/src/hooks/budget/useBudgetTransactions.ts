import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetTransaction, RecurringInterval, TxType } from '../../types/budget';

const byDateDesc = (a: BudgetTransaction, b: BudgetTransaction) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : a.created_at < b.created_at ? 1 : -1;

export interface NewTransaction {
  type: TxType;
  amount: number;
  description?: string | null;
  category_id?: string | null;
  date?: string | null;
  recurring?: boolean;
  recurring_interval?: RecurringInterval | null;
}

/**
 * Loads all of the user's budget transactions (the full history — needed for the
 * 6-month trend), keeps them synced via realtime, and exposes CRUD. Month/type
 * filtering is done by callers against the in-memory list.
 */
export function useBudgetTransactions(userId: string | null) {
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('budget_transactions')
        .select('*')
        .order('date', { ascending: false });
      if (cancelled) return;
      if (error) console.error('Failed to load transactions:', error.message);
      setTransactions(((data ?? []) as BudgetTransaction[]).sort(byDateDesc));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget-tx-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_transactions', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setTransactions((prev) => prev.filter((t) => t.id !== id));
          } else {
            const row = payload.new as BudgetTransaction;
            setTransactions((prev) => {
              const exists = prev.some((t) => t.id === row.id);
              const next = exists ? prev.map((t) => (t.id === row.id ? row : t)) : [...prev, row];
              return next.sort(byDateDesc);
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addTransaction = useCallback(
    async (input: NewTransaction): Promise<BudgetTransaction | null> => {
      if (!userId) return null;
      const id = crypto.randomUUID();
      const row: BudgetTransaction = {
        id,
        user_id: userId,
        category_id: input.category_id ?? null,
        type: input.type,
        amount: input.amount,
        description: input.description ?? null,
        date: input.date ?? new Date().toISOString().slice(0, 10),
        recurring: input.recurring ?? false,
        recurring_interval: input.recurring_interval ?? null,
        created_at: new Date().toISOString(),
      };
      setTransactions((prev) => [row, ...prev].sort(byDateDesc));
      const { id: _id, user_id: _u, created_at: _c, ...insert } = row;
      void _id; void _u; void _c;
      const { error } = await supabase
        .from('budget_transactions')
        .insert({ id, user_id: userId, ...insert });
      if (error) console.error('addTransaction failed:', error.message);
      return row;
    },
    [userId]
  );

  const updateTransaction = useCallback(
    async (id: string, patch: Partial<NewTransaction>) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? ({ ...t, ...patch } as BudgetTransaction) : t)).sort(byDateDesc)
      );
      const { error } = await supabase.from('budget_transactions').update(patch).eq('id', id);
      if (error) console.error('updateTransaction failed:', error.message);
    },
    []
  );

  const deleteTransaction = useCallback(async (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from('budget_transactions').delete().eq('id', id);
    if (error) console.error('deleteTransaction failed:', error.message);
  }, []);

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction };
}

export type UseBudgetTransactions = ReturnType<typeof useBudgetTransactions>;
