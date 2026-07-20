import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { thursdaysInMonth } from '../../types/budget';

type Sums = Record<string, number>; // group_id -> summed amount across the month

/**
 * For the monthly view: sums each group's WEEKLY allocations across the weeks
 * that roll up into the month (weeks whose Thursday falls in the month). Amounts
 * are entered per week and isolated per week; the month simply adds them up.
 * Synced via realtime. Only runs while `enabled` (the monthly view).
 */
export function useMonthlyGroupSums(
  userId: string | null,
  budgetId: string | null,
  monthStart: string,
  enabled: boolean
): Sums {
  const [sums, setSums] = useState<Sums>({});
  const thursdays = useMemo(() => (enabled ? thursdaysInMonth(monthStart) : []), [monthStart, enabled]);
  const thursdaysKey = thursdays.join(',');

  useEffect(() => {
    if (!userId || !budgetId || !enabled || thursdays.length === 0) {
      setSums({});
      return;
    }
    let cancelled = false;

    const load = async () => {
      // 1) this budget's weekly period ids for the month's Thursdays
      const { data: periods, error: pErr } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .eq('type', 'weekly')
        .in('start_date', thursdays);
      if (cancelled) return;
      if (pErr) {
        console.error('monthly group sums (periods) failed:', pErr.message);
        return;
      }
      const ids = (periods ?? []).map((p) => (p as { id: string }).id);
      if (ids.length === 0) {
        setSums({});
        return;
      }
      // 2) allocations for those periods, summed by group
      const { data: allocs, error: aErr } = await supabase
        .from('budget_allocations')
        .select('group_id, amount')
        .in('period_id', ids);
      if (cancelled) return;
      if (aErr) {
        console.error('monthly group sums (allocations) failed:', aErr.message);
        return;
      }
      const next: Sums = {};
      for (const row of (allocs ?? []) as { group_id: string; amount: number }[]) {
        next[row.group_id] = (next[row.group_id] ?? 0) + (Number(row.amount) || 0);
      }
      setSums(next);
    };

    void load();

    const channel = supabase
      .channel(`monthly-group-sums-${userId}-${budgetId}-${monthStart}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_allocations', filter: `user_id=eq.${userId}` },
        () => void load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_periods', filter: `user_id=eq.${userId}` },
        () => void load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, budgetId, monthStart, enabled, thursdaysKey]);

  return sums;
}
