import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetPeriod, PeriodBounds, Timeframe } from '../../types/budget';

/**
 * Loads (or auto-creates) the budget_periods row for a given type + date range,
 * keeps its income synced via realtime, and exposes an optimistic income setter.
 * Each navigable period (a specific day/week/month) holds its own income. When
 * the user navigates to a period that has no row yet, one is created (income 0).
 */
export function useBudgetPeriod(
  userId: string | null,
  budgetId: string | null,
  type: Timeframe,
  bounds: PeriodBounds
) {
  const { start_date, end_date, label } = bounds;
  const [period, setPeriod] = useState<BudgetPeriod | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !budgetId) {
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
        .eq('budget_id', budgetId)
        .eq('type', type)
        .eq('start_date', start_date)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('load period failed:', error.message);
        setLoading(false);
        return;
      }
      if (data) {
        setPeriod(data as BudgetPeriod);
        setLoading(false);
        return;
      }

      // No row for this period yet — auto-create with income 0.
      const row: BudgetPeriod = {
        id: crypto.randomUUID(),
        user_id: userId,
        budget_id: budgetId,
        type,
        label,
        start_date,
        end_date,
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
        .eq('budget_id', budgetId)
        .eq('type', type)
        .eq('start_date', start_date)
        .maybeSingle();
      if (cancelled) return;
      setPeriod((again as BudgetPeriod) ?? row);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, budgetId, type, start_date, end_date, label]);

  // Realtime — keep the currently-shown period's income in sync across devices.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`budget_periods-rt-${userId}-${type}`)
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
  }, [userId, type]);

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
