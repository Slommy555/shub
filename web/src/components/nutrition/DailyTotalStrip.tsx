import type { Macros, NutritionGoals } from '../../types/nutrition';

const COLUMNS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
];

/** Whole numbers with thousands separators — macros never need decimals here. */
function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

/**
 * Today's running totals, four equal columns. Tapping anywhere opens the goal
 * sheet; once goals exist each column also shows "used / goal" and a thin bar
 * that turns amber once the target is passed.
 */
export default function DailyTotalStrip({
  totals,
  goals,
  onOpenGoals,
}: {
  totals: Macros;
  goals: NutritionGoals | null;
  onOpenGoals: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenGoals}
      aria-label="Today's totals — tap to set goals"
      className="w-full rounded-2xl border p-4 text-left transition-colors sm:p-5"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <div className="grid grid-cols-4 gap-2">
        {COLUMNS.map((c) => {
          const value = totals[c.key];
          const goal = goals ? Number(goals[c.key] ?? 0) : 0;
          const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
          const over = goal > 0 && value > goal;
          return (
            <div key={c.key} className="min-w-0">
              <div
                className="truncate text-xl font-bold tabular-nums sm:text-[32px] sm:leading-tight"
                style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
              >
                {fmt(value)}
                {c.unit}
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                {c.label}
              </div>
              {goal > 0 && (
                <>
                  <div
                    className="mt-1 text-[11px] tabular-nums"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {fmt(value)} / {fmt(goal)}
                  </div>
                  <div
                    className="mt-1 h-1 w-full overflow-hidden rounded-full"
                    style={{ background: 'var(--color-bg-surface)' }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${pct}%`,
                        background: over ? 'var(--color-warning)' : 'var(--color-accent)',
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </button>
  );
}
