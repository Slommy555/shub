import type { WeightReviewModel } from '../../lib/claudeRouter';

interface Props {
  model: WeightReviewModel;
  onChange: (patch: Partial<WeightReviewModel>) => void;
  onDismiss: () => void;
}

/** "Log your weight as X lbs today?" with an editable value. */
export default function WeightConfirmCard({ model, onChange, onDismiss }: Props) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3-2" />
        </svg>
      </span>
      <div className="flex flex-1 items-center gap-2">
        <span className="text-sm text-gray-700 dark:text-gray-200">Log weight as</span>
        <input
          type="number"
          min={0}
          step="any"
          value={String(model.weight_lbs)}
          onChange={(e) => onChange({ weight_lbs: Math.max(0, Number(e.target.value) || 0) })}
          className="w-20 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
        <span className="text-sm text-gray-700 dark:text-gray-200">lbs today</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
