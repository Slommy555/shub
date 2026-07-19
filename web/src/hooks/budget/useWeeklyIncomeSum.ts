import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * Sums the income of every WEEKLY period whose start date (its Thursday) falls
 * within [monthStart, monthEnd], giving the monthly tab a derived income that
 * rolls up the individual weeks. Kept in sync via realtime so editing a week's
 * income updates the monthly total live. Only runs while `enabled`.
 */
export function useWeeklyIncomeSum(
  userId: string | null,
  monthStart: string,
  monthEnd: string,
  enabled: boolean
): number {
  const [sum, setSum] = useState(0);

  useEffect(() => {
    if (!userId || !enabled) {
      setSum(0);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('budget_periods')
        .select('income')
        .eq('user_id', userId)
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
      .channel(`weekly-income-sum-${userId}-${monthStart}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_periods', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { type?: string; start_date?: string };
          if (row?.type !== 'weekly') return;
          if (!row.start_date || row.start_date < monthStart || row.start_date > monthEnd) return;
          void load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, monthStart, monthEnd, enabled]);

  return sum;
}
