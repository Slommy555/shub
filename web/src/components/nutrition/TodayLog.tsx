import SwipeRow from '../budget/SwipeRow';
import type { NutritionLog } from '../../types/nutrition';

const TrashIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const round = (n: number) => Math.round(Number(n) || 0);

/**
 * Everything logged today. Rows swipe left to delete on touch and carry a trash
 * button for pointer devices; tapping the row body opens the edit sheet.
 */
export default function TodayLog({
  logs,
  dateLabel,
  onEdit,
  onDelete,
}: {
  logs: NutritionLog[];
  dateLabel: string;
  onEdit: (log: NutritionLog) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Today
        </h2>
        <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
          {dateLabel}
        </span>
      </div>

      {logs.length === 0 ? (
        <p className="py-10 text-center text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Nothing logged yet today
        </p>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        >
          {logs.map((log) => (
            <SwipeRow key={log.id} onDelete={() => onDelete(log.id)}>
              {/* Not a <button>: SwipeRow ignores pointer starts on buttons, so
                  a button here would kill swipe-to-delete on the row body. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onEdit(log)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onEdit(log);
                  }
                }}
                className="flex cursor-pointer items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[15px] font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {log.food_name || 'Unknown Food'}
                  </div>
                  <div className="mt-0.5 text-[11px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
                    P: {round(log.protein_g)}g&nbsp;&nbsp;C: {round(log.carbs_g)}g&nbsp;&nbsp;F: {round(log.fat_g)}g
                  </div>
                </div>

                <span
                  className="shrink-0 text-[15px] font-semibold tabular-nums"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {round(log.calories).toLocaleString()}
                </span>

                <button
                  data-no-drag
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // don't also open the edit sheet
                    onDelete(log.id);
                  }}
                  aria-label={`Delete ${log.food_name || 'entry'}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {TrashIcon}
                </button>
              </div>
            </SwipeRow>
          ))}
        </div>
      )}
    </section>
  );
}
