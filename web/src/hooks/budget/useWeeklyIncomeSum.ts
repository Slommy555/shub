import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * Sums the income of every WEEKLY period in the active budget whose start date
 * (its Thursday) falls within [monthStart, monthEnd], giving the monthly tab a
 * derived income that rolls up the individual weeks. Group AMOUNTS stay isolated
 * per period — only income rolls up. Kept in sync via realtime; only runs while
 * `enabled` (i.e. on the monthly view).
 */
export function useWeeklyIncomeSum(
  userId: string | null,
  budgetId: string | null,
  monthStart: string,
  monthEnd: string,
  enabled: boolean
): number {
  const [sum, setSum] = useState(0);

  useEffect(() => {
    if (!userId || !budgetId || !enabled) {
      setSum(0);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('budget_periods')
        .select('income')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .eq('type', 'weekly')
        .gte('start_date', monthStart)
        .lte('start_date', monthEnd);
      if (cancelled) return;
      if (error) {
        console.error('weekly income sum failed:', error.message);
        return;
      }
      setSum((data ?? []).reduce((a, r) => a + (Number((r as { income: number }).income) || 0), 0));
    };

    void load();

    const channel = supabase
      .channel(`weekly-income-sum-${userId}-${budgetId}-${monthStart}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_periods', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { type?: string; start_date?: string; budget_id?: string };
          if (row?.type !== 'weekly' || row.budget_id !== budgetId) return;
          if (!row.start_date || row.start_date < monthStart || row.start_date > monthEnd) return;
          void load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId, monthStart, monthEnd, enabled]);

  return sum;
}
