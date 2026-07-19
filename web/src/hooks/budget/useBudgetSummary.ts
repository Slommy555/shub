import { useMemo } from 'react';
import type { BudgetAllocation } from '../../types/budget';

export interface BudgetSummary {
  income: number;
  allocated: number;
  remaining: number;
}

/**
 * Derives the summary strip values client-side so they update instantly as
 * income, any group amount, or the timeframe changes (no Supabase round trip).
 * Amounts are stored at a weekly base; `factor` rescales income/allocated/
 * remaining into the currently-selected timeframe. Allocated is the sum of
 * every group's amount; remaining is income minus allocated.
 */
export function useBudgetSummary(
  income: number,
  allocations: Record<string, BudgetAllocation>,
  factor: number
): BudgetSummary {
  return useMemo(() => {
    const allocated = Object.values(allocations).reduce((s, a) => s + (Number(a.amount) || 0), 0);
    return {
      income: income * factor,
      allocated: allocated * factor,
      remaining: (income - allocated) * factor,
    };
  }, [income, allocations, factor]);
}
