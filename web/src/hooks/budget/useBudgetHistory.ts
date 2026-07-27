import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface HistoryMonth {
  month: string; // YYYY-MM-01
  label: string; // "Jul"
  income: number; // total of that month's pay-day incomes
  saved: number; // total of that month's savings deposits
}

/** Shift a YYYY-MM-01 by n months (n may be negative). */
function shiftMonth(monthStart: string, n: number): string {
  const [y, m] = monthStart.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Trailing per-month income + savings totals ending at (and including) the month
 * in view — the trend behind the Snapshot's numbers. Both series are keyed off
 * the pay-day Thursday's own month, matching how the rest of the budget assigns
 * a 5th Thursday to the month it falls in.
 */
export function useBudgetHistory(
  userId: string | null,
  budgetId: string | null,
  monthStart: string,
  months = 6
): HistoryMonth[] {
  const [history, setHistory] = useState<HistoryMonth[]>([]);
  const from = shiftMonth(monthStart, -(months - 1));
  const to = shiftMonth(monthStart, 1); // exclusive

  useEffect(() => {
    if (!userId || !budgetId) {
      setHistory([]);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const [{ data: periods }, { data: deposits }] = await Promise.all([
        supabase
          .from('budget_periods')
          .select('start_date, income')
          .eq('budget_id', budgetId)
          .eq('type', 'weekly')
          .gte('start_date', from)
          .lt('start_date', to),
        supabase
          .from('budget_savings_deposits')
          .select('week_start, amount')
          .eq('budget_id', budgetId)
          .gte('week_start', from)
          .lt('week_start', to),
      ]);
      if (cancelled) return;

      const incomeBy: Record<string, number> = {};
      for (const p of (periods ?? []) as { start_date: string; income: number }[]) {
        const key = `${p.start_date.slice(0, 7)}-01`;
        incomeBy[key] = (incomeBy[key] ?? 0) + (Number(p.income) || 0);
      }
      const savedBy: Record<string, number> = {};
      for (const d of (deposits ?? []) as { week_start: string; amount: number }[]) {
        const key = `${d.week_start.slice(0, 7)}-01`;
        savedBy[key] = (savedBy[key] ?? 0) + (Number(d.amount) || 0);
      }

      const out: HistoryMonth[] = [];
      for (let i = 0; i < months; i++) {
        const month = shiftMonth(from, i);
        out.push({
          month,
          label: new Date(month + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' }),
          income: incomeBy[month] ?? 0,
          saved: savedBy[month] ?? 0,
        });
      }
      setHistory(out);
    };

    void load();

    const channel = supabase
      .channel(`budget-history-${userId}-${budgetId}-${monthStart}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_periods', filter: `user_id=eq.${userId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_savings_deposits', filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, budgetId, from, to, months, monthStart]);

  return history;
}
