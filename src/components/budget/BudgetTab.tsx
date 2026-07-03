import { useState } from 'react';
import { useBudgetCategories } from '../../hooks/budget/useBudgetCategories';
import { useBudgetTransactions } from '../../hooks/budget/useBudgetTransactions';
import { useSavingsGoals } from '../../hooks/budget/useSavingsGoals';
import { useBudgetSettings } from '../../hooks/budget/useBudgetSettings';
import OverviewTab from './OverviewTab';
import TransactionsTab from './TransactionsTab';
import GoalsTab from './GoalsTab';
import BudgetSettingsTab from './BudgetSettingsTab';

type Sub = 'overview' | 'transactions' | 'goals' | 'settings';

const SUBS: { id: Sub; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'goals', label: 'Goals' },
  { id: 'settings', label: 'Settings' },
];

export default function BudgetTab({ userId }: { userId: string }) {
  const [sub, setSub] = useState<Sub>('overview');
  const categoriesApi = useBudgetCategories(userId);
  const transactionsApi = useBudgetTransactions(userId);
  const goalsApi = useSavingsGoals(userId);
  const settingsApi = useBudgetSettings(userId);

  const currency = settingsApi.settings?.currency_symbol ?? '$';

  return (
    <div className="pb-fab mx-auto w-full max-w-app px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight">Budget</h1>

      {/* Sub-tab switcher */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 bg-gray-50/95 px-4 py-2 backdrop-blur dark:bg-gray-950/95">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 p-1 dark:border-gray-700">
          {SUBS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSub(s.id)}
              aria-pressed={sub === s.id}
              className={[
                'flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                sub === s.id
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {sub === 'overview' && (
        <OverviewTab
          transactions={transactionsApi.transactions}
          categories={categoriesApi.categories}
          settings={settingsApi.settings}
          currency={currency}
          onSeeAll={() => setSub('transactions')}
        />
      )}
      {sub === 'transactions' && (
        <TransactionsTab
          api={transactionsApi}
          categories={categoriesApi.categories}
          currency={currency}
        />
      )}
      {sub === 'goals' && <GoalsTab api={goalsApi} currency={currency} />}
      {sub === 'settings' && (
        <BudgetSettingsTab categoriesApi={categoriesApi} settingsApi={settingsApi} />
      )}
    </div>
  );
}
