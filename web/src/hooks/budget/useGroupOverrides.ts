import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetGroupOverride } from '../../types/budget';

/**
 * One-month amount overrides for recurring groups, for the month in view.
 *
 * An override replaces a group's monthly amount for exactly that month and
 * nothing else — car insurance at $180 every month except the $210 March
 * renewal. Resolution lives in `resolvedMonthlyOf` (BudgetView), which is the
 * single function every display and total goes through.
 */
export function useGroupOverrides(
  userId: string | null,
  budgetId: string | null,
  monthStart: string
) {
  const [overrides, setOverrides] = useState<BudgetGroupOverride[]>([]);

  useEffect(() => {
    if (!userId || !budgetId) {
      setOverrides([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('budget_group_overrides')
        .select('*')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .eq('month', monthStart);
      if (cancelled) return;
      if (error) console.error('load group overrides failed:', error.message);
      else setOverrides((data as BudgetGroupOverride[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, budgetId, monthStart]);

  /** The override row for a group this month, or null when it uses the default. */
  const overrideFor = useCallback(
    (groupId: string): BudgetGroupOverride | null =>
      overrides.find((o) => o.group_id === groupId) ?? null,
    [overrides]
  );

  /**
   * Set (or update) this month's override. Upserted on (group_id, month) so
   * re-editing the same month replaces rather than duplicates.
   */
  const setOverride = useCallback(
    async (groupId: string, amount: number, note?: string | null) => {
      if (!userId || !budgetId) return;
      const existing = overrides.find((o) => o.group_id === groupId);
      const row = {
        id: existing?.id ?? crypto.randomUUID(),
        user_id: userId,
        group_id: groupId,
        budget_id: budgetId,
        month: monthStart,
        override_amount: Math.max(0, amount),
        note: note !== undefined ? note : existing?.note ?? null,
        created_at: existing?.created_at ?? new Date().toISOString(),
      } as BudgetGroupOverride;

      setOverrides((prev) => {
        const rest = prev.filter((o) => o.group_id !== groupId);
        return [...rest, row];
      });
      const { error } = await supabase
        .from('budget_group_overrides')
        .upsert(row, { onConflict: 'group_id,month' });
      if (error) console.error('setOverride failed:', error.message);
    },
    [userId, budgetId, monthStart, overrides]
  );

  /** Drop this month's override — the group reverts to its default amount. */
  const clearOverride = useCallback(
    async (groupId: string) => {
      const existing = overrides.find((o) => o.group_id === groupId);
      if (!existing) return;
      setOverrides((prev) => prev.filter((o) => o.group_id !== groupId));
      const { error } = await supabase
        .from('budget_group_overrides')
        .delete()
        .eq('id', existing.id);
      if (error) console.error('clearOverride failed:', error.message);
    },
    [overrides]
  );

  return { overrides, overrideFor, setOverride, clearOverride };
}
