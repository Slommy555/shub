import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { payThursdaysForMonth } from '../../types/budget';

/**
 * Sums the income of the active budget's WEEKLY periods that roll up into a
 * month, normalised to 4 pay periods: a month keeps its first four Thursdays and
 * a 5th Thursday's income overflows into the next month (see
 * `payThursdaysForMonth`). Targeting the precise Thursdays counts each week once
 * and ignores legacy non-Thursday week rows. Synced via realtime; only runs
 * while `enabled` (the monthly view).
 */
export function useWeeklyIncomeSum(
  userId: string | null,
  budgetId: string | null,
  monthStart: string,
  enabled: boolean
): number {
  const [sum, setSum] = useState(0);
  const thursdays = useMemo(() => (enabled ? payThursdaysForMonth(monthStart) : []), [monthStart, enabled]);
  const thursdaysKey = thursdays.join(',');

  useEffect(() => {
    if (!userId || !budgetId || !enabled || thursdays.length === 0) {
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
        .in('start_date', thursdays);
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
          if (!row.start_date || !thursdays.includes(row.start_date)) return;
          void load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, budgetId, monthStart, enabled, thursdaysKey]);

  return sum;
}
