import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { thursdaysInMonth } from '../../types/budget';

export interface SavingsDeposit {
  date: string; // the Thursday, YYYY-MM-DD
  label: string; // e.g. "Thu Jul 3"
  amount: number;
}

/** First day of the month after `monthStart` (YYYY-MM-01 → next YYYY-MM-01). */
function firstOfNextMonth(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number);
  const d = new Date(y, m, 1); // m is 1-based → this is the next month's first day
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Custom weekly savings deposits. Exposes the selected month's four pay-day
 * deposits (editable), the month's total, and the cumulative total put away from
 * `startMonth` through the end of the selected month (the running balance's
 * contributions). Backed by budget_savings_deposits, synced via realtime.
 */
export function useSavingsDeposits(
  userId: string | null,
  budgetId: string | null,
  monthStart: string,
  startMonth: string
) {
  const thursdays = useMemo(() => thursdaysInMonth(monthStart), [monthStart]);
  const thursdaysKey = thursdays.join(',');
  const throughEnd = firstOfNextMonth(monthStart);

  const [amounts, setAmounts] = useState<Record<string, number>>({}); // week_start -> amount (this month)
  const [contributionsThrough, setContributionsThrough] = useState(0);
  const amountsRef = useRef<Record<string, number>>({});
  amountsRef.current = amounts;

  useEffect(() => {
    if (!userId || !budgetId) {
      setAmounts({});
      setContributionsThrough(0);
      return;
    }
    let cancelled = false;

    const load = async () => {
      // This month's four pay-day deposits.
      const { data: rows, error } = await supabase
        .from('budget_savings_deposits')
        .select('week_start, amount')
        .eq('budget_id', budgetId)
        .in('week_start', thursdays);
      if (!cancelled && !error) {
        const map: Record<string, number> = {};
        for (const r of (rows ?? []) as { week_start: string; amount: number }[]) {
          map[r.week_start] = Number(r.amount) || 0;
        }
        setAmounts(map);
      }

      // Cumulative deposits from startMonth through the end of the selected month.
      const { data: all, error: cErr } = await supabase
        .from('budget_savings_deposits')
        .select('amount')
        .eq('budget_id', budgetId)
        .gte('week_start', startMonth)
        .lt('week_start', throughEnd);
      if (!cancelled && !cErr) {
        setContributionsThrough(
          (all ?? []).reduce((a, r) => a + (Number((r as { amount: number }).amount) || 0), 0)
        );
      }
    };

    void load();

    const channel = supabase
      .channel(`savings-deposits-${userId}-${budgetId}-${monthStart}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_savings_deposits', filter: `user_id=eq.${userId}` },
        () => void load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, budgetId, thursdaysKey, startMonth, throughEnd]);

  const setDeposit = useCallback(
    async (weekStart: string, amount: number) => {
      if (!userId || !budgetId) return;
      const value = Math.max(0, amount);
      setAmounts((prev) => ({ ...prev, [weekStart]: value }));
      const { error } = await supabase
        .from('budget_savings_deposits')
        .upsert(
          { user_id: userId, budget_id: budgetId, week_start: weekStart, amount: value },
          { onConflict: 'budget_id,week_start' }
        );
      if (error) console.error('set savings deposit failed:', error.message);
    },
    [userId, budgetId]
  );

  const deposits: SavingsDeposit[] = thursdays.map((date) => ({
    date,
    label: new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    amount: amounts[date] ?? 0,
  }));

  const monthTotal = deposits.reduce((s, d) => s + d.amount, 0);

  return { deposits, monthTotal, contributionsThrough, setDeposit };
}
