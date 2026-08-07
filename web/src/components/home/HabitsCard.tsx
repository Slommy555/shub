import { useHabits } from '../../hooks/useHabits';
import { todayISO } from '../../lib/dates';
import { haptic } from '../../lib/native';
import { Card, CardSkeleton, CheckCircle, SectionHeader } from './parts';

/**
 * Today's habits, checkable in place. This writes through the same `useHabits`
 * hook the Focus tab uses — the same `habits` / `habit_logs` tables — so a tick
 * here and a tick there are the same row, and realtime keeps both views in sync.
 */
export default function HabitsCard({ userId }: { userId: string }) {
  const { habits, loading, doneByHabit, toggle } = useHabits(userId);
  const today = todayISO();

  if (loading) return <CardSkeleton rows={4} />;
  if (habits.length === 0) {
    return (
      <Card>
        <SectionHeader title="Habits" />
        <p className="text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
          No habits yet
        </p>
      </Card>
    );
  }

  const doneCount = habits.filter((h) => doneByHabit.get(h.id)?.has(today)).length;

  return (
    <Card>
      <SectionHeader title="Habits" meta={`${doneCount} / ${habits.length} complete`} />
      {/* Mobile caps the list at ~5 rows and scrolls; on wider screens the card
          stretches to fill its grid cell and the list grows into it. */}
      <div className="-mr-1 flex max-h-[200px] min-h-0 flex-1 flex-col overflow-y-auto pr-1 sm:max-h-none">
        {habits.map((h) => {
          const done = doneByHabit.get(h.id)?.has(today) ?? false;
          return (
            <div key={h.id} className="flex items-center gap-2" style={{ minHeight: 40 }}>
              <CheckCircle
                checked={done}
                label={h.name}
                onToggle={() => {
                  if (!done) haptic();
                  void toggle(h.id, today);
                }}
              />
              <span
                className="min-w-0 flex-1 truncate text-[15px]"
                style={{
                  color: done ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                  textDecoration: done ? 'line-through' : 'none',
                }}
              >
                {h.name}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
