import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { endOfMonth, shiftMonthStart, type SavingsEvent } from '../../lib/savingsSeries';

/**
 * The budget tracker's own savings movements, as dated events from the account's
 * start month through the end of the month in view:
 *
 *  - deposits (budget_savings_deposits) land on their pay-day Thursday, +.
 *  - a month's earmarks (group + scheduled-expense) land on that month's first
 *    day, −. Earmarks are a whole-month commitment with no date of their own, and
 *    dating them at the start of the month is what makes the trend's balance agree
 *    with the Snapshot's savings tile (which already nets out the current month's
 *    allocations).
 *
 * Combine with useSavingsAdjustments' events for the full picture.
 */
export function useSavingsFlows(
  userId: string | null,
  budgetId: string | null,
  startMonth: string,
  monthStart: string
): SavingsEvent[] {
  const [events, setEvents] = useState<SavingsEvent[]>([]);
  const monthEnd = endOfMonth(monthStart);
  const throughExclusive = shiftMonthStart(monthStart, 1);

  useEffect(() => {
    if (!userId || !budgetId) {
      setEvents([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const [{ data: deposits, error: dErr }, { data: periods, error: pErr }] = await Promise.all([
        supabase
          .from('budget_savings_deposits')
          .select('week_start, amount')
          .eq('budget_id', budgetId)
          .gte('week_start', startMonth)
          .lte('week_start', monthEnd),
        supabase
          .from('budget_periods')
          .select('id, start_date')
          .eq('user_id', userId)
          .eq('budget_id', budgetId)
          .eq('type', 'monthly')
          .gte('start_date', startMonth)
          .lt('start_date', throughExclusive),
      ]);
      if (cancelled) return;
      if (dErr) console.error('load savings deposit history failed:', dErr.message);
      if (pErr) console.error('load savings period history failed:', pErr.message);

      const out: SavingsEvent[] = [];
      for (const d of (deposits ?? []) as { week_start: string; amount: number }[]) {
        const amount = Number(d.amount) || 0;
        if (amount !== 0) out.push({ date: d.week_start, delta: amount, kind: 'deposit', label: 'Put away' });
      }

      // Earmarks hang off pools, pools off periods — walk down to get each
      // month's total drawn out of the pool.
      const periodStartById = new Map<string, string>();
      for (const p of (periods ?? []) as { id: string; start_date: string }[]) periodStartById.set(p.id, p.start_date);

      if (periodStartById.size > 0) {
        const { data: pools } = await supabase
          .from('budget_savings_pools')
          .select('id, period_id')
          .in('period_id', [...periodStartById.keys()]);
        if (cancelled) return;
        const monthByPool = new Map<string, string>();
        for (const pool of (pools ?? []) as { id: string; period_id: string }[]) {
          const month = periodStartById.get(pool.period_id);
          if (month) monthByPool.set(pool.id, month);
        }

        if (monthByPool.size > 0) {
          const poolIds = [...monthByPool.keys()];
          const [{ data: marks }, { data: exMarks }] = await Promise.all([
            supabase.from('budget_savings_earmarks').select('pool_id, amount').in('pool_id', poolIds),
            supabase.from('budget_savings_expense_earmarks').select('pool_id, amount').in('pool_id', poolIds),
          ]);
          if (cancelled) return;

          const byMonth: Record<string, number> = {};
          for (const row of [...((marks ?? []) as { pool_id: string; amount: number }[]), ...((exMarks ?? []) as { pool_id: string; amount: number }[])]) {
            const month = monthByPool.get(row.pool_id);
            if (!month) continue;
            byMonth[month] = (byMonth[month] ?? 0) + (Number(row.amount) || 0);
          }
          for (const [month, total] of Object.entries(byMonth)) {
            if (total !== 0) out.push({ date: month, delta: -total, kind: 'earmark', label: 'Allocated out' });
          }
        }
      }

      setEvents(out.sort((a, b) => a.date.localeCompare(b.date)));
    };

    void load();

    const channel = supabase
      .channel(`savings-flows-${userId}-${budgetId}-${monthStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_savings_deposits', filter: `user_id=eq.${userId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_savings_earmarks', filter: `user_id=eq.${userId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_savings_expense_earmarks', filter: `user_id=eq.${userId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_savings_pools', filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId, startMonth, monthStart, monthEnd, throughExclusive]);

  return events;
}
