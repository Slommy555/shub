import { useMemo, useState } from 'react';
import DailyTotalStrip from './DailyTotalStrip';
import GoalSheet from './GoalSheet';
import LabelScanner from './LabelScanner';
import MealDescriber from './MealDescriber';
import TodayLog from './TodayLog';
import EditLogSheet from './EditLogSheet';
import { useNutritionLogs } from '../../hooks/nutrition/useNutritionLogs';
import { useNutritionGoals } from '../../hooks/nutrition/useNutritionGoals';
import { toISODate } from '../../lib/dates';
import type { NutritionLog } from '../../types/nutrition';

/**
 * Nutrition tab: today's macro totals on top, the two ways of logging a meal in
 * the middle — scan a label, or describe it in plain language — and today's log
 * at the bottom. `.nutrition-scope` injects the UI_SKILL.md color tokens (shared
 * with the Budget tab) scoped to this tab only.
 */
export default function NutritionTab({ userId }: { userId: string }) {
  const today = useMemo(() => toISODate(new Date()), []);
  const { logs, totals, addLog, addLogs, updateLog, deleteLog } = useNutritionLogs(userId, today);
  const { goals, saveGoals } = useNutritionGoals(userId);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [editing, setEditing] = useState<NutritionLog | null>(null);

  const dateLabel = useMemo(
    () =>
      new Date(`${today}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [today]
  );

  return (
    <div
      className="nutrition-scope min-h-screen"
      style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}
    >
      <div className="pb-fab mx-auto w-full max-w-app px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-xl font-bold" style={{ letterSpacing: '-0.02em' }}>
          Nutrition
        </h1>

        <DailyTotalStrip totals={totals} goals={goals} onOpenGoals={() => setGoalsOpen(true)} />

        <LabelScanner onAdd={addLog} />

        <MealDescriber onAddAll={addLogs} />

        <TodayLog logs={logs} dateLabel={dateLabel} onEdit={setEditing} onDelete={deleteLog} />
      </div>

      {goalsOpen && (
        <GoalSheet goals={goals} onSave={saveGoals} onClose={() => setGoalsOpen(false)} />
      )}

      {editing && (
        <EditLogSheet log={editing} onSave={updateLog} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
