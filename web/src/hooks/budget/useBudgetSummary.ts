import { useMemo } from 'react';
import type { BudgetAllocation } from '../../types/budget';

export interface BudgetSummary {
  income: number;
  allocated: number;
  remaining: number;
}

/**
 * Derives the summary strip values client-side so they update instantly as
 * income or any group amount changes (no Supabase round trip). Allocated is the
 * sum of every group's amount; remaining is income minus allocated.
 */
export function useBudgetSummary(
  income: number,
  allocations: Record<string, BudgetAllocation>
): BudgetSummary {
  return useMemo(() => {
    const allocated = Object.values(allocations).reduce((s, a) => s + (Number(a.amount) || 0), 0);
    return { income, allocated, remaining: income - allocated };
  }, [income, allocations]);
}
