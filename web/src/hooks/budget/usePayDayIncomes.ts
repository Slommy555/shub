import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { periodForCursor, thursdaysInMonth, type BudgetPeriod } from '../../types/budget';

export interface PayDay {
  /** The Thursday's date, YYYY-MM-DD. */
  date: string;
  /** Short display label, e.g. "Thu Jul 3". */
  label: string;
  income: number;
}

type RowMap = Record<string, BudgetPeriod>; // keyed by start_date (the Thursday)

/**
 * EVERY pay-day Thursday whose date falls in the calendar month (4 or 5), each
 * backed by its own WEEKLY budget_periods row. A 5th Thursday (e.g. Jul 30)
 * counts for its own month — it is never dropped or pushed into the next month.
 * Each pay day's income is editable and upserts on the
 * (user_id, budget_id, type, start_date) unique key. Kept in sync via realtime.
 */
export function usePayDayIncomes(
  userId: string | null,
  budgetId: string | null,
  monthStart: string
) {
  const thursdays = useMemo(() => thursdaysInMonth(monthStart), [monthStart]);
  const thursdaysKey = thursdays.join(',');

  const [rows, setRows] = useState<RowMap>({});
  const rowsRef = useRef<RowMap>({});
  rowsRef.current = rows;

  useEffect(() => {
    if (!userId || !budgetId || thursdays.length === 0) {
      setRows({});
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('budget_periods')
        .select('*')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .eq('type', 'weekly')
        .in('start_date', thursdays);
      if (cancelled) return;
      if (error) {
        console.error('load pay days failed:', error.message);
        return;
      }
      const map: RowMap = {};
      for (const row of (data as BudgetPeriod[]) ?? []) map[row.start_date] = row;
      setRows(map);
    };

    void load();

    const channel = supabase
      .channel(`paydays-rt-${userId}-${budgetId}-${monthStart}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budget_periods', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          const row = payload.new as BudgetPeriod;
          if (row.budget_id !== budgetId || row.type !== 'weekly') return;
          if (!thursdays.includes(row.start_date)) return;
          setRows((prev) => ({ ...prev, [row.start_date]: row }));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, budgetId, monthStart, thursdaysKey]);

  const setIncome = useCallback(
    async (thursday: string, income: number) => {
      if (!userId || !budgetId) return;
      const value = Math.max(0, income);
      const bounds = periodForCursor('weekly', new Date(thursday + 'T00:00:00'));

      setRows((prev) => {
        const base =
          prev[thursday] ??
          ({
            id: crypto.randomUUID(),
            user_id: userId,
            budget_id: budgetId,
            type: 'weekly',
            label: bounds.label,
            start_date: bounds.start_date,
            end_date: bounds.end_date,
            income: 0,
          } as BudgetPeriod);
        return { ...prev, [thursday]: { ...base, income: value } };
      });

      const { data, error } = await supabase
        .from('budget_periods')
        .upsert(
          {
            user_id: userId,
            budget_id: budgetId,
            type: 'weekly',
            label: bounds.label,
            start_date: bounds.start_date,
            end_date: bounds.end_date,
            income: value,
          },
          { onConflict: 'user_id,budget_id,type,start_date' }
        )
        .select()
        .single();
      if (error) {
        console.error('set pay day income failed:', error.message);
        return;
      }
      if (data) setRows((prev) => ({ ...prev, [thursday]: data as BudgetPeriod }));
    },
    [userId, budgetId]
  );

  const payDays: PayDay[] = thursdays.map((date) => ({
    date,
    label: new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    income: Number(rows[date]?.income) || 0,
  }));

  const monthlyIncome = payDays.reduce((sum, p) => sum + p.income, 0);

  return { payDays, monthlyIncome, setIncome };
}

export type UsePayDayIncomes = ReturnType<typeof usePayDayIncomes>;
