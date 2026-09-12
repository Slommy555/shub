import type { TemplateEdit } from '../../types/workout';

interface Props {
  /** What changed — never empty; the caller skips this sheet when there are no edits. */
  edits: TemplateEdit[];
  saving: boolean;
  onDontSave: () => void;
  onSave: () => void;
}

/** One change, phrased the way the user made it. */
function line(e: TemplateEdit): string {
  switch (e.kind) {
    case 'added':
      return `Added: ${e.name}`;
    case 'removed':
      return `Removed: ${e.name}`;
    case 'reordered':
      return 'Reordered exercises';
    case 'changed':
      return `Changed: ${e.name} — ${e.detail ?? ''}`;
  }
}

/**
 * Shown between "Finish workout" and the completion summary when the session
 * drifted from the template it started from. Only structural changes are on
 * offer — the weights logged today are workout data and stay out of it, which
 * the footnote says out loud so "Save to Template" isn't a gamble.
 */
export default function TemplateEditPrompt({ edits, saving, onDontSave, onSave }: Props) {
  return (
    <div
      data-no-swipe
      role="dialog"
      aria-modal="true"
      aria-label="Save changes to template?"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="w-full max-w-app rounded-t-3xl bg-white p-5 shadow-xl animate-slide-up dark:bg-gray-900 sm:rounded-3xl">
        <h2 className="text-lg font-bold">Save changes to template?</h2>
        <p className="mt-1 text-sm text-gray-500">You made changes to this workout:</p>

        <ul className="mt-3 max-h-56 space-y-1.5 overflow-y-auto rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/60">
          {edits.map((e, i) => (
            <li key={`${e.kind}-${e.name}-${i}`} className="flex gap-2 text-sm">
              <span aria-hidden className="shrink-0 text-gray-400">
                •
              </span>
              <span className="min-w-0 break-words">{line(e)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-[11px] text-gray-400">
          Exercises, sets, reps and order only — the weights you logged today stay in this
          workout.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onDontSave}
            disabled={saving}
            className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold disabled:opacity-60 dark:border-gray-700"
          >
            Don't Save
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-accent flex-1 px-4 py-3 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save to Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
