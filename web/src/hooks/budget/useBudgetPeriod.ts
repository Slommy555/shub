import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { STANDALONE_END, STANDALONE_START, type BudgetPeriod } from '../../types/budget';

/**
 * Loads (or auto-creates) the user's single persistent budget row, keeps its
 * income synced via realtime, and exposes an optimistic income setter. There is
 * exactly one row per user (type 'standalone'); it holds the income the whole
 * budget is measured against.
 */
export function useBudgetPeriod(userId: string | null) {
  const [period, setPeriod] = useState<BudgetPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPeriod(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setPeriod(null);

    (async () => {
      const { data, error } = await supabase
        .from('budget_periods')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'standalone')
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('load budget failed:', error.message);
        setLoading(false);
        return;
      }
      if (data) {
        setPeriod(data as BudgetPeriod);
        setLoading(false);
        return;
      }

      // No budget row yet — auto-create with income 0.
      const row: BudgetPeriod = {
        id: crypto.randomUUID(),
        user_id: userId,
        type: 'standalone',
        label: 'Budget',
        start_date: STANDALONE_START,
        end_date: STANDALONE_END,
        income: 0,
      };
      const { data: inserted, error: insErr } = await supabase
        .from('budget_periods')
        .insert(row)
        .select()
        .single();
      if (cancelled) return;
      if (!insErr && inserted) {
        setPeriod(inserted as BudgetPeriod);
        setLoading(false);
        return;
      }
      // Another device may have created it first (unique violation) — re-select.
      const { data: again } = await supabase
        .from('budget_periods')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'standalone')
        .maybeSingle();
      if (cancelled) return;
      setPeriod((again as BudgetPeriod) ?? row);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Realtime — keep income in sync across devices.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget_periods-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_periods', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as BudgetPeriod;
          setPeriod((prev) => (prev && prev.id === row.id ? row : prev));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const setIncome = useCallback(
    async (income: number) => {
      let id: string | undefined;
      setPeriod((prev) => {
        id = prev?.id;
        return prev ? { ...prev, income } : prev;
      });
      if (!id) return;
      const { error } = await supabase.from('budget_periods').update({ income }).eq('id', id);
      if (error) console.error('setIncome failed:', error.message);
    },
    []
  );

  return { period, loading, setIncome };
}

export type UseBudgetPeriod = ReturnType<typeof useBudgetPeriod>;
