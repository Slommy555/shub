import type {
  ProposedDeletion,
  ProposedReschedule,
  ProposedTask,
  ProposedWorkShift,
} from '../../types/voice';
import { reviewHasContent, type ReviewModel } from '../../lib/claudeRouter';
import VoiceTranscript from '../VoiceTranscript';
import ProposedTaskCard from '../ProposedTaskCard';
import NewActionSections from './NewActionSections';

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  recording: boolean;
  transcript: string;
  finalTranscript: string;
  parsing: boolean;
  parseError: string | null;
  proposed: ProposedTask[];
  reschedules: ProposedReschedule[];
  deletions: ProposedDeletion[];
  workShifts: ProposedWorkShift[];
  /** Habit/workout/weight/reminder sections from the app-wide actions pass. */
  extras: ReviewModel;
  stopKeyword: string;
  /** Mobile uses tap-to-stop, so the "say [keyword]" hint is replaced. */
  mobile?: boolean;
  onStop: () => void;
  onRetry: () => void;
  onChangeProposed: (id: string, patch: Partial<ProposedTask>) => void;
  onDeleteProposed: (id: string) => void;
  onAddAnother: () => void;
  onDismissReschedule: (id: string) => void;
  onDismissDeletion: (id: string) => void;
  onChangeWorkShift: (id: string, patch: Partial<ProposedWorkShift>) => void;
  onDismissWorkShift: (id: string) => void;
  onChangeExtras: (patch: Partial<ReviewModel>) => void;
  onReset: () => void;
  onConfirm: () => void;
}

/**
 * The floating mic/review panel. Appears bottom-right over any tab while
 * recording or reviewing, so the user never has to leave the page they're on.
 */
export default function VoicePopup(props: Props) {
  const {
    recording,
    transcript,
    finalTranscript,
    parsing,
    parseError,
    proposed,
    reschedules,
    deletions,
    workShifts,
    extras,
    stopKeyword,
    mobile,
  } = props;

  const confirmDisabled =
    proposed.filter((t) => t.text.trim()).length === 0 &&
    reschedules.length === 0 &&
    deletions.length === 0 &&
    workShifts.length === 0 &&
    !reviewHasContent(extras);

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(26rem,calc(100vw-2rem))] animate-slide-up">
      <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <span className="relative grid h-7 w-7 shrink-0 place-items-center">
            {recording && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
            )}
            <span
              className={[
                'relative grid h-7 w-7 place-items-center rounded-full text-white',
                recording ? 'bg-red-500' : 'bg-gray-800 dark:bg-gray-200 dark:text-gray-900',
              ].join(' ')}
            >
              <MicIcon size={15} />
            </span>
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {recording ? 'Listening…' : parsing ? 'Parsing…' : 'Review'}
          </p>
          {recording ? (
            <button
              type="button"
              onClick={props.onStop}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={props.onReset}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          {recording ? (
            <>
              <VoiceTranscript text={transcript} live placeholder="Listening…" />
              <p className="text-center text-xs text-gray-400">
                {mobile ? 'Tap the mic button to stop' : `Say “${stopKeyword}” to finish`}
              </p>
            </>
          ) : parsing ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <span className="skeleton h-4 w-4 rounded-full" />
              Parsing your tasks with Claude…
            </div>
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Transcript
                </p>
                <VoiceTranscript text={finalTranscript} placeholder="(empty)" />
              </div>

              {parseError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <p>{parseError}</p>
                  <button
                    type="button"
                    onClick={props.onRetry}
                    className="mt-2 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                  >
                    Retry parsing
                  </button>
                </div>
              )}

              {/* Proposed tasks */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Proposed tasks
                </p>
                <div className="space-y-3">
                  {proposed.map((t) => (
                    <ProposedTaskCard
                      key={t.id}
                      task={t}
                      onChange={(patch) => props.onChangeProposed(t.id, patch)}
                      onDelete={() => props.onDeleteProposed(t.id)}
                    />
                  ))}
                  {proposed.length === 0 && !parseError && (
                    <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400 dark:border-gray-800">
                      No new tasks — add one below or start over.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={props.onAddAnother}
                  className="mt-3 w-full rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                >
                  + Add another task
                </button>
              </div>

              {/* Work-schedule changes */}
              {workShifts.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    Work schedule
                  </p>
                  <div className="space-y-2">
                    {workShifts.map((w) => (
                      <div
                        key={w.id}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                            {w.weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ')}
                          </p>
                          <button
                            type="button"
                            onClick={() => props.onDismissWorkShift(w.id)}
                            aria-label="Dismiss this schedule change"
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-white/70 hover:text-gray-700 dark:hover:bg-black/20"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="time"
                            value={w.start}
                            onChange={(e) => props.onChangeWorkShift(w.id, { start: e.target.value })}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
                          />
                          <span className="text-xs text-gray-400">to</span>
                          <input
                            type="time"
                            value={w.end}
                            onChange={(e) => props.onChangeWorkShift(w.id, { end: e.target.value })}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Confirming updates your work days in Settings and shows these as blocks in the Schedule view.
                  </p>
                </div>
              )}

              {/* Suggested moves */}
              {reschedules.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />
                    </svg>
                    Suggested moves to make room
                  </p>
                  <div className="space-y-2">
                    {reschedules.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {r.taskText}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                            {formatMoveDate(r.from)} →{' '}
                            <span className="font-semibold">{formatMoveDate(r.to)}</span>
                          </p>
                          {r.reason && (
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{r.reason}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => props.onDismissReschedule(r.id)}
                          aria-label="Dismiss this move"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-white/60 hover:text-gray-700 dark:hover:bg-black/20"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks to remove */}
              {deletions.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                    To remove
                  </p>
                  <div className="space-y-2">
                    {deletions.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800 line-through dark:text-gray-100">
                            {d.taskText}
                          </p>
                          {d.reason && (
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{d.reason}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => props.onDismissDeletion(d.id)}
                          aria-label="Keep this task"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-white/60 hover:text-gray-700 dark:hover:bg-black/20"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* App-wide actions: habits, workout, weight, reminders */}
              <NewActionSections review={extras} onChange={props.onChangeExtras} />
            </>
          )}
        </div>

        {/* Footer actions (review only) */}
        {!recording && !parsing && (
          <div className="flex gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
            <button
              type="button"
              onClick={props.onReset}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              disabled={confirmDisabled}
              className="flex-1 rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add to my list
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMoveDate(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MicIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}
