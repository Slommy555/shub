import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { SavingsGoal } from '../../types/budget';

const byCreated = (a: SavingsGoal, b: SavingsGoal) => (a.created_at < b.created_at ? -1 : 1);

export interface NewGoal {
  name: string;
  target_amount: number;
  target_date?: string | null;
  color?: string | null;
}

export function useSavingsGoals(userId: string | null) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setGoals([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) console.error('Failed to load goals:', error.message);
      setGoals(((data ?? []) as SavingsGoal[]).sort(byCreated));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`savings-goals-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_goals', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setGoals((prev) => prev.filter((g) => g.id !== id));
          } else {
            const row = payload.new as SavingsGoal;
            setGoals((prev) => {
              const exists = prev.some((g) => g.id === row.id);
              const next = exists ? prev.map((g) => (g.id === row.id ? row : g)) : [...prev, row];
              return next.sort(byCreated);
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addGoal = useCallback(
    async (input: NewGoal) => {
      if (!userId) return;
      const id = crypto.randomUUID();
      const row: SavingsGoal = {
        id,
        user_id: userId,
        name: input.name.trim() || 'Goal',
        target_amount: input.target_amount,
        current_amount: 0,
        target_date: input.target_date ?? null,
        color: input.color ?? null,
        created_at: new Date().toISOString(),
      };
      setGoals((prev) => [...prev, row].sort(byCreated));
      const { error } = await supabase.from('savings_goals').insert({
        id,
        user_id: userId,
        name: row.name,
        target_amount: row.target_amount,
        current_amount: 0,
        target_date: row.target_date,
        color: row.color,
      });
      if (error) console.error('addGoal failed:', error.message);
    },
    [userId]
  );

  const updateGoal = useCallback(
    async (id: string, patch: Partial<Pick<SavingsGoal, 'name' | 'target_amount' | 'current_amount' | 'target_date' | 'color'>>) => {
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)).sort(byCreated));
      const { error } = await supabase.from('savings_goals').update(patch).eq('id', id);
      if (error) console.error('updateGoal failed:', error.message);
    },
    []
  );

  const deleteGoal = useCallback(async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    const { error } = await supabase.from('savings_goals').delete().eq('id', id);
    if (error) console.error('deleteGoal failed:', error.message);
  }, []);

  /**
   * Add funds to a goal: bumps current_amount and records a matching `savings`
   * transaction (the transactions hook picks it up via realtime).
   */
  const addFunds = useCallback(
    async (goal: SavingsGoal, amount: number) => {
      if (!userId || amount <= 0) return;
      const next = goal.current_amount + amount;
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, current_amount: next } : g)));
      const { error } = await supabase
        .from('savings_goals')
        .update({ current_amount: next })
        .eq('id', goal.id);
      if (error) console.error('addFunds (goal) failed:', error.message);
      const { error: txErr } = await supabase.from('budget_transactions').insert({
        id: crypto.randomUUID(),
        user_id: userId,
        type: 'savings',
        amount,
        description: `Added to ${goal.name}`,
        date: new Date().toISOString().slice(0, 10),
      });
      if (txErr) console.error('addFunds (tx) failed:', txErr.message);
    },
    [userId]
  );

  return { goals, loading, addGoal, updateGoal, deleteGoal, addFunds };
}

export type UseSavingsGoals = ReturnType<typeof useSavingsGoals>;
