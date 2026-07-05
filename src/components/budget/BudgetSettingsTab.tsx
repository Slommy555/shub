import { useState } from 'react';
import type { UseBudgetCategories } from '../../hooks/budget/useBudgetCategories';
import type { UseBudgetSettings } from '../../hooks/budget/useBudgetSettings';
import { BUDGET_COLORS, TX_TYPES, TX_TYPE_LABEL, type BudgetCategory, type TxType } from '../../types/budget';

const inputCls =
  'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

function CategoryRow({
  cat,
  api,
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  cat: BudgetCategory;
  api: UseBudgetCategories;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const [showColors, setShowColors] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowColors((v) => !v)}
          aria-label="Change color"
          className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: cat.color ?? '#9ca3af' }}
        />
        <input
          defaultValue={cat.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== cat.name) api.updateCategory(cat.id, { name: v });
          }}
          aria-label="Category name"
          className={`min-w-0 flex-1 ${inputCls}`}
        />
        {cat.type === 'expense' && (
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            defaultValue={cat.monthly_limit ?? ''}
            onBlur={(e) => {
              const v = e.target.value.trim();
              const n = v === '' ? null : Number(v);
              if (n !== cat.monthly_limit) api.updateCategory(cat.id, { monthly_limit: n });
            }}
            placeholder="Limit"
            aria-label="Monthly limit"
            className={`w-20 ${inputCls}`}
          />
        )}
        <div className="flex shrink-0 flex-col">
          <button type="button" disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label="Move up" className="px-1 text-[10px] leading-none text-gray-400 disabled:opacity-30">▲</button>
          <button type="button" disabled={!canMoveDown} onClick={() => onMove(1)} aria-label="Move down" className="px-1 text-[10px] leading-none text-gray-400 disabled:opacity-30">▼</button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete "${cat.name}"? Transactions keep their history but lose this category label.`)) {
              api.deleteCategory(cat.id);
            }
          }}
          aria-label="Delete category"
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
        >
          ×
        </button>
      </div>
      {showColors && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BUDGET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                api.updateCategory(cat.id, { color: c });
                setShowColors(false);
              }}
              aria-label={`Set color ${c}`}
              className="h-5 w-5 rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BudgetSettingsTab({
  categoriesApi,
  settingsApi,
}: {
  categoriesApi: UseBudgetCategories;
  settingsApi: UseBudgetSettings;
}) {
  const { settings, save } = settingsApi;
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<TxType>('expense');

  const move = (list: BudgetCategory[], index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    categoriesApi.reorderCategories(next);
  };

  return (
    <div className="space-y-5">
      {/* Categories by type */}
      {TX_TYPES.map((type) => {
        const list = categoriesApi.categories.filter((c) => c.type === type);
        return (
          <section key={type}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{TX_TYPE_LABEL[type]}</p>
            <div className="space-y-2">
              {list.map((cat, i) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  api={categoriesApi}
                  canMoveUp={i > 0}
                  canMoveDown={i < list.length - 1}
                  onMove={(dir) => move(list, i, dir)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Add category */}
      <div className="flex gap-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category"
          aria-label="New category name"
          className={`min-w-0 flex-1 ${inputCls}`}
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as TxType)} aria-label="New category type" className={inputCls}>
          {TX_TYPES.map((t) => (
            <option key={t} value={t}>
              {TX_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (newName.trim()) {
              categoriesApi.addCategory({ name: newName, type: newType });
              setNewName('');
            }
          }}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-semibold text-white dark:bg-gray-200 dark:text-gray-900"
        >
          Add
        </button>
      </div>

      {/* Alert threshold */}
      {settings && (
        <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Alert threshold</p>
            <span className="text-sm font-semibold tabular-nums">{Math.round(settings.alert_threshold * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={settings.alert_threshold}
            onChange={(e) => save({ alert_threshold: Number(e.target.value) })}
            className="mt-2 w-full accent-indigo-600"
            aria-label="Alert threshold"
          />
          <p className="mt-1 text-xs text-gray-400">Warn when an expense category reaches this share of its monthly limit.</p>
        </section>
      )}

      {/* Preferences */}
      {settings && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">Monthly income target</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              defaultValue={settings.monthly_income_target ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                save({ monthly_income_target: v === '' ? null : Number(v) });
              }}
              placeholder="—"
              aria-label="Monthly income target"
              className={`w-28 ${inputCls}`}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">Weekly spending limit</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              defaultValue={settings.weekly_spending_limit ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                save({ weekly_spending_limit: v === '' ? null : Number(v) });
              }}
              placeholder="—"
              aria-label="Weekly spending limit"
              className={`w-28 ${inputCls}`}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">Weekly savings goal</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              defaultValue={settings.weekly_savings_target ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                save({ weekly_savings_target: v === '' ? null : Number(v) });
              }}
              placeholder="—"
              aria-label="Weekly savings goal"
              className={`w-28 ${inputCls}`}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">Currency symbol</label>
            <input
              defaultValue={settings.currency_symbol}
              onBlur={(e) => save({ currency_symbol: e.target.value.trim() || '$' })}
              aria-label="Currency symbol"
              className={`w-16 text-center ${inputCls}`}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">Week starts on</label>
            <select
              value={settings.week_start}
              onChange={(e) => save({ week_start: e.target.value as 'monday' | 'sunday' })}
              aria-label="Week start"
              className={inputCls}
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </div>
        </section>
      )}
    </div>
  );
}
