import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ScheduledExpense } from '../../types/budget';

/**
 * One-off / irregular expenses for a budget, each due in a specific month
 * (stored as that month's first day). Loaded for the whole budget and filtered
 * by month in the UI — an expense only shows and only counts toward totals in
 * its due month; it never repeats. Realtime-synced, optimistic writes.
 */
export function useScheduledExpenses(userId: string | null, budgetId: string | null) {
  const [expenses, setExpenses] = useState<ScheduledExpense[]>([]);
  const ref = useRef<ScheduledExpense[]>([]);
  ref.current = expenses;

  useEffect(() => {
    if (!userId || !budgetId) {
      setExpenses([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('budget_scheduled_expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .order('due_month', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('load scheduled expenses failed:', error.message);
        return;
      }
      setExpenses((data as ScheduledExpense[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, budgetId]);

  useEffect(() => {
    if (!userId || !budgetId) return;
    const channel = supabase
      .channel(`budget_scheduled_expenses-rt-${userId}-${budgetId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_scheduled_expenses', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setExpenses((prev) => prev.filter((e) => e.id !== id));
            return;
          }
          const row = payload.new as ScheduledExpense;
          if (row.budget_id !== budgetId) return;
          setExpenses((prev) => {
            const exists = prev.some((e) => e.id === row.id);
            return exists ? prev.map((e) => (e.id === row.id ? row : e)) : [...prev, row];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId]);

  /** Add an expense for a specific pay date; its month is derived from that date. */
  const addExpense = useCallback(
    async (name: string, amount: number, dueDate: string) => {
      if (!userId || !budgetId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = crypto.randomUUID();
      const value = Math.max(0, amount);
      const dueMonth = `${dueDate.slice(0, 7)}-01`; // first of the pay date's month
      const row: ScheduledExpense = {
        id,
        user_id: userId,
        budget_id: budgetId,
        name: trimmed,
        amount: value,
        due_month: dueMonth,
        due_date: dueDate,
        created_at: new Date().toISOString(),
      };
      setExpenses((prev) => [...prev, row]);
      const { error } = await supabase
        .from('budget_scheduled_expenses')
        .insert({ id, user_id: userId, budget_id: budgetId, name: trimmed, amount: value, due_month: dueMonth, due_date: dueDate });
      if (error) console.error('addExpense failed:', error.message);
    },
    [userId, budgetId]
  );

  const deleteExpense = useCallback(async (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('budget_scheduled_expenses').delete().eq('id', id);
    if (error) console.error('deleteExpense failed:', error.message);
  }, []);

  return { expenses, addExpense, deleteExpense };
}

export type UseScheduledExpenses = ReturnType<typeof useScheduledExpenses>;
