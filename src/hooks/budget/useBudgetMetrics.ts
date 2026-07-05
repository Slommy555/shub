import { useMemo } from 'react';
import type {
  BudgetCategory,
  BudgetSettings,
  BudgetTransaction,
} from '../../types/budget';

export interface CategorySpend {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
}

export interface BudgetAlert {
  categoryId: string;
  name: string;
  color: string;
  spent: number;
  limit: number;
  ratio: number;
  level: 'warning' | 'over';
}

export interface MonthlyPoint {
  label: string; // e.g. "Feb"
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  net: number;
}

export interface WeeklyPoint {
  label: string; // "Mon"
  amount: number;
}

const WEEK_LABELS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_LABELS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthKey = (d: string) => d.slice(0, 7);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Local YYYY-MM-DD for a Date. */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * All derived budget figures for the Overview tab, computed from the raw
 * transactions/categories/settings for a given month (defaults to the current
 * month). Pure and memoized.
 */
export function useBudgetMetrics(
  transactions: BudgetTransaction[],
  categories: BudgetCategory[],
  settings: BudgetSettings | null,
  month: string = new Date().toISOString().slice(0, 7)
) {
  const alertThreshold = settings?.alert_threshold ?? 0.8;
  const weekStart = settings?.week_start ?? 'monday';

  return useMemo(() => {
    const inMonth = transactions.filter((t) => monthKey(t.date) === month);
    const sum = (list: BudgetTransaction[], type: string) =>
      round2(list.filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount || 0), 0));

    const totalIncome = sum(inMonth, 'income');
    const totalExpenses = sum(inMonth, 'expense');
    const totalSavings = sum(inMonth, 'savings');
    const net = round2(totalIncome - totalExpenses);

    // Spending breakdown by expense category (donut).
    const catById = new Map(categories.map((c) => [c.id, c]));
    const spendMap = new Map<string | null, number>();
    for (const t of inMonth) {
      if (t.type !== 'expense') continue;
      const key = t.category_id ?? null;
      spendMap.set(key, (spendMap.get(key) ?? 0) + Number(t.amount || 0));
    }
    const spendingByCategory: CategorySpend[] = [...spendMap.entries()]
      .map(([categoryId, amount]) => {
        const cat = categoryId ? catById.get(categoryId) : undefined;
        return {
          categoryId,
          name: cat?.name ?? 'Uncategorized',
          color: cat?.color ?? '#9ca3af',
          amount: round2(amount),
        };
      })
      .sort((a, b) => b.amount - a.amount);

    // Budget alerts — expense categories with a limit at/over threshold.
    const alerts: BudgetAlert[] = [];
    for (const c of categories) {
      if (c.type !== 'expense' || !c.monthly_limit || c.monthly_limit <= 0) continue;
      const spent = round2(
        inMonth
          .filter((t) => t.type === 'expense' && t.category_id === c.id)
          .reduce((s, t) => s + Number(t.amount || 0), 0)
      );
      const ratio = spent / c.monthly_limit;
      if (ratio >= alertThreshold) {
        alerts.push({
          categoryId: c.id,
          name: c.name,
          color: c.color ?? '#9ca3af',
          spent,
          limit: c.monthly_limit,
          ratio,
          level: ratio >= 1 ? 'over' : 'warning',
        });
      }
    }
    alerts.sort((a, b) => b.ratio - a.ratio);

    // Weekly trend — daily expense totals for the current week.
    const now = new Date();
    const dow = now.getDay(); // 0=Sun..6=Sat
    const offsetToStart = weekStart === 'monday' ? (dow + 6) % 7 : dow;
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - offsetToStart);
    const labels = weekStart === 'monday' ? WEEK_LABELS_MON : WEEK_LABELS_SUN;
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    const weekStartISO = isoLocal(weekStartDate);
    const weekEndISO = isoLocal(weekEndDate);
    const inWeek = transactions.filter((t) => t.date >= weekStartISO && t.date <= weekEndISO);
    const weeklyTrend: WeeklyPoint[] = labels.map((label, i) => {
      const d = new Date(weekStartDate);
      d.setDate(weekStartDate.getDate() + i);
      const iso = isoLocal(d);
      const amount = round2(
        transactions
          .filter((t) => t.type === 'expense' && t.date === iso)
          .reduce((s, t) => s + Number(t.amount || 0), 0)
      );
      return { label, amount };
    });

    // This week's totals vs the optional weekly limit / savings goal.
    const weekSpent = sum(inWeek, 'expense');
    const weekSaved = sum(inWeek, 'savings');
    const weekly = {
      rangeStart: weekStartISO,
      rangeEnd: weekEndISO,
      spent: weekSpent,
      saved: weekSaved,
      spendingLimit: settings?.weekly_spending_limit ?? null,
      savingsTarget: settings?.weekly_savings_target ?? null,
    };

    // Monthly trend — last 6 months (oldest → newest).
    const monthlyTrend: MonthlyPoint[] = [];
    const base = new Date(`${month}-01T00:00:00`);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const list = transactions.filter((t) => monthKey(t.date) === mk);
      const income = sum(list, 'income');
      const expenses = sum(list, 'expense');
      monthlyTrend.push({
        label: MONTH_ABBR[d.getMonth()],
        month: mk,
        income,
        expenses,
        net: round2(income - expenses),
      });
    }

    const recent = transactions.slice(0, 5);

    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      net,
      spendingByCategory,
      alerts,
      weeklyTrend,
      weekly,
      monthlyTrend,
      recent,
    };
  }, [
    transactions,
    categories,
    month,
    alertThreshold,
    weekStart,
    settings?.weekly_spending_limit,
    settings?.weekly_savings_target,
  ]);
}

export type BudgetMetrics = ReturnType<typeof useBudgetMetrics>;
