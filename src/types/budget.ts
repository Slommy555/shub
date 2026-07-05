// Budget Tracker domain types. Amounts are plain numbers (dollars); the
// currency symbol is a display-only preference on BudgetSettings.

export type TxType = 'income' | 'expense' | 'savings';
export type RecurringInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface BudgetCategory {
  id: string;
  user_id: string;
  name: string;
  type: TxType;
  color: string | null;
  monthly_limit: number | null;
  position: number;
  created_at: string;
}

export interface BudgetTransaction {
  id: string;
  user_id: string;
  category_id: string | null;
  type: TxType;
  amount: number;
  description: string | null;
  date: string; // YYYY-MM-DD
  recurring: boolean;
  recurring_interval: RecurringInterval | null;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  color: string | null;
  created_at: string;
}

export interface BudgetSettings {
  id: string;
  user_id: string;
  monthly_income_target: number | null;
  currency_symbol: string;
  week_start: 'monday' | 'sunday';
  alert_threshold: number; // 0..1
  /** Overall weekly expense cap; null = no cap. */
  weekly_spending_limit: number | null;
  /** Weekly savings goal; null = no goal. */
  weekly_savings_target: number | null;
}

export const TX_TYPES: TxType[] = ['income', 'expense', 'savings'];

export const TX_TYPE_LABEL: Record<TxType, string> = {
  income: 'Income',
  expense: 'Expense',
  savings: 'Savings',
};

// A palette of hex colors used for categories/goals and the charts. Kept as raw
// hex (not Tailwind classes) so Recharts can consume them directly.
export const BUDGET_COLORS: string[] = [
  '#6366f1', // indigo
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#3b82f6', // blue
  '#84cc16', // lime
  '#8b5cf6', // violet
];

export interface DefaultCategorySeed {
  name: string;
  type: TxType;
}

// Seeded per-user on first load (see useBudgetCategories).
export const DEFAULT_BUDGET_CATEGORIES: DefaultCategorySeed[] = [
  { name: 'Paycheck', type: 'income' },
  { name: 'Side Income', type: 'income' },
  { name: 'Other Income', type: 'income' },
  { name: 'Housing', type: 'expense' },
  { name: 'Food', type: 'expense' },
  { name: 'Transport', type: 'expense' },
  { name: 'Entertainment', type: 'expense' },
  { name: 'Health', type: 'expense' },
  { name: 'Shopping', type: 'expense' },
  { name: 'Bills', type: 'expense' },
  { name: 'Other', type: 'expense' },
  { name: 'Emergency Fund', type: 'savings' },
  { name: 'General Savings', type: 'savings' },
];
