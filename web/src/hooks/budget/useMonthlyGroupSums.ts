import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Sums = Record<string, number>; // group_id -> summed amount across the month

/**
 * For the monthly tab: sums each group's non-persistent allocations across every
 * WEEKLY period whose start (its Thursday) falls within [monthStart, monthEnd].
 * Mirrors how monthly income rolls up the weeks. Kept in sync via realtime.
 * Only runs while `enabled`.
 */
export function useMonthlyGroupSums(
  userId: string | null,
  monthStart: string,
  monthEnd: string,
  enabled: boolean
): Sums {
  const [sums, setSums] = useState<Sums>({});

  useEffect(() => {
    if (!userId || !enabled) {
      setSums({});
      return;
    }
    let cancelled = false;

    const load = async () => {
      // 1) weekly period ids in this month
      const { data: periods, error: pErr } = await supabase
        .from('budget_periods')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'weekly')
        .gte('start_date', monthStart)
        .lte('start_date', monthEnd);
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
      .channel(`monthly-group-sums-${userId}-${monthStart}`)
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
  }, [userId, monthStart, monthEnd, enabled]);

  return sums;
}
