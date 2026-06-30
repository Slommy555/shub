import type { WorkoutReviewModel } from '../../lib/claudeRouter';

interface Props {
  model: WorkoutReviewModel;
  onDismiss: () => void;
}

/** Confirmation that a workout will be started on the Log tab. */
export default function WorkoutStartCard({ model, onDismiss }: Props) {
  const willStart = model.freestyle || !model.matchedName;
  const label = willStart ? 'freestyle workout' : model.matchedName;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 6.5 17.5 17.5M4 8l-1 1 2 2M20 16l1-1-2-2M7 4 6 5l4 4M17 20l1-1-4-4" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Start <span className="font-semibold">{label}</span>
        </p>
        <p className="text-xs text-gray-400">
          {willStart && model.templateName
            ? `No template matched “${model.templateName}” — starting freestyle.`
            : 'Opens the Workout → Log tab with the session started.'}
        </p>
      </div>
      <DismissButton onClick={onDismiss} />
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
