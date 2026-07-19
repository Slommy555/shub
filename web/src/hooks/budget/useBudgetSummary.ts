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
 * use their shared weekly-base amount scaled by `factor`, while non-persistent
 * groups spread their current-month balance across the timeframe via `divisor`
 * (monthly ÷1, weekly ÷weeks-left, daily ÷days-left).
 */
export function useBudgetSummary(
  income: number,
  groups: BudgetGroup[],
  monthlyAllocs: Record<string, BudgetAllocation>,
  factor: number,
  divisor: number
): BudgetSummary {
  return useMemo(() => {
    const allocated = groups.reduce((sum, g) => {
      const value = g.persistent
        ? (Number(g.amount) || 0) * factor
        : (Number(monthlyAllocs[g.id]?.amount) || 0) / divisor;
      return sum + value;
    }, 0);
    return { income, allocated, remaining: income - allocated };
  }, [income, groups, monthlyAllocs, factor, divisor]);
}
