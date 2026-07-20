import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/**
 * Total savings allocated (earmarked) across every month from `startMonth` up to
 * — but not including — `selectedMonthStart`. This is the amount already drawn
 * out of the running savings balance before the month currently in view, so the
 * current month's own allocations can be tracked separately. Re-queried whenever
 * pools or earmarks change.
 */
export function useSavingsWithdrawnBefore(
  userId: string | null,
  budgetId: string | null,
  startMonth: string,
  selectedMonthStart: string
): number {
  const [withdrawn, setWithdrawn] = useState(0);

  useEffect(() => {
    if (!userId || !budgetId || selectedMonthStart <= startMonth) {
      setWithdrawn(0);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data: periods } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .eq('type', 'monthly')
        .gte('start_date', startMonth)
        .lt('start_date', selectedMonthStart);
      if (cancelled) return;
      const periodIds = (periods ?? []).map((p) => (p as { id: string }).id);
      if (periodIds.length === 0) {
        setWithdrawn(0);
        return;
      }
      const { data: pools } = await supabase
        .from('budget_savings_pools')
        .select('id')
        .in('period_id', periodIds);
      if (cancelled) return;
      const poolIds = (pools ?? []).map((p) => (p as { id: string }).id);
      if (poolIds.length === 0) {
        setWithdrawn(0);
        return;
      }
      const { data: marks } = await supabase
        .from('budget_savings_earmarks')
        .select('amount')
        .in('pool_id', poolIds);
      if (cancelled) return;
      setWithdrawn((marks ?? []).reduce((a, r) => a + (Number((r as { amount: number }).amount) || 0), 0));
    };

    void load();

    const channel = supabase
      .channel(`savings-withdrawn-${userId}-${budgetId}-${selectedMonthStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_savings_earmarks', filter: `user_id=eq.${userId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_savings_pools', filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId, startMonth, selectedMonthStart]);

  return withdrawn;
}
