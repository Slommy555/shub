import { useMemo } from 'react';
import type { BudgetAllocation } from '../../types/budget';

export interface BudgetSummary {
  income: number;
  spent: number;
  remaining: number;
}

/**
 * Derives the summary strip values client-side so they update instantly as
 * income or spent values change (no Supabase round trip). Spent is the sum of
 * every allocation's `spent`; remaining is income minus spent.
 */
export function useBudgetSummary(
  income: number,
  allocations: Record<string, BudgetAllocation>
): BudgetSummary {
  return useMemo(() => {
    const spent = Object.values(allocations).reduce((s, a) => s + (Number(a.spent) || 0), 0);
    return { income, spent, remaining: income - spent };
  }, [income, allocations]);
}
