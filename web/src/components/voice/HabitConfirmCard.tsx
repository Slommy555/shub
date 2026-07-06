import type { HabitReviewModel } from '../../lib/claudeRouter';

interface Props {
  model: HabitReviewModel;
  onRemoveTarget: (id: string) => void;
}

/** Preview of which habits will be marked complete today. */
export default function HabitConfirmCard({ model, onRemoveTarget }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        Marking these habits as complete today{model.all ? ' (all incomplete)' : ''}:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {model.targets.map((h) => (
          <span
            key={h.id}
            className="inline-flex items-center gap-1 rounded-full bg-green-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-300"
          >
            {h.name}
            <button
              type="button"
              onClick={() => onRemoveTarget(h.id)}
              aria-label={`Remove ${h.name}`}
              className="grid h-4 w-4 place-items-center rounded-full hover:bg-green-200/60 dark:hover:bg-green-500/20"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      {model.unmatched.length > 0 && (
        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          No match for: {model.unmatched.join(', ')}
        </p>
      )}
    </div>
  );
}
