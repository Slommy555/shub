import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { PeriodBounds } from '../../types/budget';

/**
 * Resolves (creating if needed) the monthly budget_periods row for a month, and
 * returns its id. The savings pool is a MONTHLY concept, so every view (daily /
 * weekly / monthly) anchors its pool to this id — an earmark set on the month is
 * then visible from the weeks too. Income 0 on auto-create (harmless).
 */
export function useMonthPeriodId(
  userId: string | null,
  budgetId: string | null,
  monthBounds: PeriodBounds
): string | null {
  const { start_date, end_date, label } = monthBounds;
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !budgetId) {
      setId(null);
      return;
    }
    let cancelled = false;
    setId(null);

    const find = async () =>
      (
        await supabase
          .from('budget_periods')
          .select('id')
          .eq('user_id', userId)
          .eq('budget_id', budgetId)
          .eq('type', 'monthly')
          .eq('start_date', start_date)
          .maybeSingle()
      ).data as { id: string } | null;

    (async () => {
      const existing = await find();
      if (cancelled) return;
      if (existing) {
        setId(existing.id);
        return;
      }
      const { data: inserted } = await supabase
        .from('budget_periods')
        .insert({ user_id: userId, budget_id: budgetId, type: 'monthly', label, start_date, end_date, income: 0 })
        .select('id')
        .single();
      if (cancelled) return;
      if (inserted) {
        setId((inserted as { id: string }).id);
        return;
      }
      // Unique violation (created concurrently) — re-select.
      const again = await find();
      if (!cancelled) setId(again?.id ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, budgetId, start_date, end_date, label]);

  return id;
}
