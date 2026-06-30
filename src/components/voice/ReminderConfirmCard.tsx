import type { ReminderReviewModel } from '../../lib/claudeRouter';

interface Props {
  model: ReminderReviewModel;
  onChange: (patch: Partial<ReminderReviewModel>) => void;
  onDismiss: () => void;
}

/** "YYYY-MM-DDTHH:MM" in local time for a datetime-local input. */
function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReminderConfirmCard({ model, onChange, onDismiss }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
          {model.text}
        </p>
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
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
        <input
          type="datetime-local"
          value={toLocalInput(model.datetime)}
          onChange={(e) =>
            onChange({ datetime: e.target.value ? new Date(e.target.value).toISOString() : null })
          }
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
        />
        <select
          value={model.recurring ?? 'none'}
          onChange={(e) =>
            onChange({
              recurring: e.target.value === 'none' ? null : (e.target.value as 'daily' | 'weekly'),
            })
          }
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
        >
          <option value="none">Once</option>
          <option value="daily">Every day</option>
          <option value="weekly">Every week</option>
        </select>
      </div>
    </div>
  );
}
