import { useMemo } from 'react';
import type { BudgetAllocation, BudgetGroup } from '../../types/budget';

export interface BudgetSummary {
  income: number;
  allocated: number;
  remaining: number;
}

/**
 * Derives the summary strip for the period being viewed. Income is the period's
 * own (flat) income. Allocated sums each group's contribution: persistent groups
 * use their shared weekly-base amount scaled by the timeframe `factor`, while
 * non-persistent groups use their flat per-period allocation (no scaling).
 */
export function useBudgetSummary(
  income: number,
  groups: BudgetGroup[],
  allocations: Record<string, BudgetAllocation>,
  factor: number
): BudgetSummary {
  return useMemo(() => {
    const allocated = groups.reduce((sum, g) => {
      const value = g.persistent
        ? (Number(g.amount) || 0) * factor
        : Number(allocations[g.id]?.amount) || 0;
      return sum + value;
    }, 0);
    return { income, allocated, remaining: income - allocated };
  }, [income, groups, allocations, factor]);
}
