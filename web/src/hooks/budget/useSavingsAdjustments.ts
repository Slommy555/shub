import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { SavingsEvent } from '../../lib/savingsSeries';

export interface SavingsAdjustment {
  id: string;
  user_id: string;
  budget_id: string;
  adj_date: string; // YYYY-MM-DD
  amount: number; // signed: + into savings, − out of it
  kind: 'manual' | 'balance';
  note: string;
}

/**
 * Hand-entered movements of the savings balance — the money that never passes
 * through the budget tracker (cash put away, an unplanned withdrawal, interest).
 *
 * Two kinds share the table:
 *  - 'manual'  — an entry the user added outright.
 *  - 'balance' — the delta behind editing a day/week/month balance on the trend.
 *                At most one per date, so re-editing the same bucket rewrites it
 *                instead of stacking corrections.
 *
 * Both are stored as DELTAS, never absolute balances: a later deposit or
 * allocation still moves the balance after a hand-edit, which is the whole point
 * of keeping the balance derived.
 */
export function useSavingsAdjustments(userId: string | null, budgetId: string | null) {
  const [rows, setRows] = useState<SavingsAdjustment[]>([]);
  const rowsRef = useRef<SavingsAdjustment[]>([]);
  rowsRef.current = rows;

  useEffect(() => {
    if (!userId || !budgetId) {
      setRows([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('budget_savings_adjustments')
        .select('*')
        .eq('budget_id', budgetId)
        .order('adj_date', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('load savings adjustments failed:', error.message);
        return;
      }
      setRows(((data ?? []) as SavingsAdjustment[]).map((r) => ({ ...r, amount: Number(r.amount) || 0 })));
    };

    void load();

    const channel = supabase
      .channel(`savings-adjustments-${userId}-${budgetId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_savings_adjustments', filter: `user_id=eq.${userId}` },
        () => void load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId]);

  /** Add a one-off movement (signed). */
  const addAdjustment = useCallback(
    async (date: string, amount: number, note: string) => {
      if (!userId || !budgetId || !amount) return;
      const optimistic: SavingsAdjustment = {
        id: crypto.randomUUID(),
        user_id: userId,
        budget_id: budgetId,
        adj_date: date,
        amount,
        kind: 'manual',
        note,
      };
      setRows((prev) => [...prev, optimistic].sort((a, b) => a.adj_date.localeCompare(b.adj_date)));
      const { data, error } = await supabase
        .from('budget_savings_adjustments')
        .insert({ user_id: userId, budget_id: budgetId, adj_date: date, amount, kind: 'manual', note })
        .select()
        .single();
      if (error) {
        console.error('add savings adjustment failed:', error.message);
        setRows((prev) => prev.filter((r) => r.id !== optimistic.id));
        return;
      }
      setRows((prev) =>
        prev
          .map((r) => (r.id === optimistic.id ? ({ ...(data as SavingsAdjustment), amount: Number((data as SavingsAdjustment).amount) || 0 }) : r))
          .sort((a, b) => a.adj_date.localeCompare(b.adj_date))
      );
    },
    [userId, budgetId]
  );

  const deleteAdjustment = useCallback(async (id: string) => {
    const prevRows = rowsRef.current;
    setRows((prev) => prev.filter((r) => r.id !== id));
    const { error } = await supabase.from('budget_savings_adjustments').delete().eq('id', id);
    if (error) {
      console.error('delete savings adjustment failed:', error.message);
      setRows(prevRows);
    }
  }, []);

  /**
   * Nudge the running balance on `date` by `delta` — the write behind editing a
   * balance on the trend. Folds into that date's existing balance row, and clears
   * the row when the correction cancels out.
   */
  const adjustBalanceAt = useCallback(
    async (date: string, delta: number) => {
      if (!userId || !budgetId || Math.abs(delta) < 0.005) return;
      const existing = rowsRef.current.find((r) => r.kind === 'balance' && r.adj_date === date);
      const next = Math.round(((existing?.amount ?? 0) + delta) * 100) / 100;

      if (existing && Math.abs(next) < 0.005) {
        await deleteAdjustment(existing.id);
        return;
      }
      if (existing) {
        setRows((prev) => prev.map((r) => (r.id === existing.id ? { ...r, amount: next } : r)));
        const { error } = await supabase.from('budget_savings_adjustments').update({ amount: next }).eq('id', existing.id);
        if (error) console.error('update balance adjustment failed:', error.message);
        return;
      }
      const optimistic: SavingsAdjustment = {
        id: crypto.randomUUID(),
        user_id: userId,
        budget_id: budgetId,
        adj_date: date,
        amount: next,
        kind: 'balance',
        note: '',
      };
      setRows((prev) => [...prev, optimistic].sort((a, b) => a.adj_date.localeCompare(b.adj_date)));
      const { data, error } = await supabase
        .from('budget_savings_adjustments')
        .insert({ user_id: userId, budget_id: budgetId, adj_date: date, amount: next, kind: 'balance', note: '' })
        .select()
        .single();
      if (error) {
        console.error('insert balance adjustment failed:', error.message);
        setRows((prev) => prev.filter((r) => r.id !== optimistic.id));
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === optimistic.id ? { ...(data as SavingsAdjustment), amount: Number((data as SavingsAdjustment).amount) || 0 } : r
        )
      );
    },
    [userId, budgetId, deleteAdjustment]
  );

  /** Sum of every adjustment dated on or before `iso`. */
  const totalThrough = useCallback(
    (iso: string) => rows.filter((r) => r.adj_date <= iso).reduce((s, r) => s + r.amount, 0),
    [rows]
  );

  /** The adjustments as trend events. */
  const events: SavingsEvent[] = rows.map((r) => ({
    date: r.adj_date,
    delta: r.amount,
    kind: r.kind,
    label: r.note || (r.kind === 'balance' ? 'Balance edit' : r.amount >= 0 ? 'Added by hand' : 'Taken out by hand'),
  }));

  return { adjustments: rows, events, addAdjustment, deleteAdjustment, adjustBalanceAt, totalThrough };
}

export type UseSavingsAdjustments = ReturnType<typeof useSavingsAdjustments>;
