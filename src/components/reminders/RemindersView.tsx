import { useEffect, useMemo, useState } from 'react';
import type { UseScheduledReminders } from '../../hooks/useScheduledReminders';
import {
  REMINDER_REPEATS,
  REMINDER_REPEAT_LABEL,
  type Reminder,
  type ReminderRepeat,
} from '../../types/reminders';
import { notifPermission, requestNotifPermission, type NotifPermission } from '../../lib/notifications';

interface Props {
  api: UseScheduledReminders;
}

/** "YYYY-MM-DDTHH:MM" in local time, for a datetime-local input default. */
function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const past = diff < 0;
  const mins = Math.round(Math.abs(diff) / 60000);
  let str: string;
  if (mins < 1) str = 'now';
  else if (mins < 60) str = `${mins}m`;
  else if (mins < 1440) str = `${Math.round(mins / 60)}h`;
  else str = `${Math.round(mins / 1440)}d`;
  if (str === 'now') return 'now';
  return past ? `${str} ago` : `in ${str}`;
}

export default function RemindersView({ api }: Props) {
  const { reminders, loading, error, addReminder, deleteReminder } = api;

  const [perm, setPerm] = useState<NotifPermission>(notifPermission());
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() => localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [repeat, setRepeat] = useState<ReminderRepeat>('none');

  // Keep the permission label fresh if it changes elsewhere.
  useEffect(() => {
    setPerm(notifPermission());
  }, [reminders.length]);

  const { upcoming, past } = useMemo(() => {
    const up: Reminder[] = [];
    const pa: Reminder[] = [];
    for (const r of reminders) {
      if (r.fired && r.repeat === 'none') pa.push(r);
      else up.push(r);
    }
    return { upcoming: up, past: pa.reverse() };
  }, [reminders]);

  async function enableNotifications() {
    setPerm(await requestNotifPermission());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !when) return;
    addReminder({
      title: trimmed,
      body: null,
      remind_at: new Date(when).toISOString(), // local input → UTC
      repeat,
    });
    setTitle('');
    setRepeat('none');
    setWhen(localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold tracking-tight">Reminders</h1>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Get an OS notification at a time you choose.
      </p>

      {/* Compact nudge only when notifications can't reach the user. Detailed
          guidance lives in Settings → Notifications. */}
      {perm !== 'granted' && (
        <Banner tone="amber">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {perm === 'unsupported'
                ? 'This browser doesn’t support notifications.'
                : 'Notifications are off — reminders can’t reach you yet.'}
            </span>
            {perm !== 'unsupported' && (
              <button
                type="button"
                onClick={enableNotifications}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
              >
                Enable
              </button>
            )}
          </div>
        </Banner>
      )}

      {error && <Banner tone="red">{error}</Banner>}

      {/* Add form */}
      <form
        onSubmit={submit}
        className="mb-5 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Remind me to…"
          className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
          />
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
          >
            {REMINDER_REPEATS.map((r) => (
              <option key={r} value={r}>
                {REMINDER_REPEAT_LABEL[r]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!title.trim() || !when}
            className="ml-auto rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
          >
            Add reminder
          </button>
        </div>
      </form>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
      ) : (
        <>
          <Section title="Upcoming">
            {upcoming.length === 0 ? (
              <Empty>No upcoming reminders.</Empty>
            ) : (
              upcoming.map((r) => (
                <ReminderRow key={r.id} reminder={r} onDelete={() => deleteReminder(r.id)} />
              ))
            )}
          </Section>

          {past.length > 0 && (
            <Section title="Past">
              {past.slice(0, 20).map((r) => (
                <ReminderRow key={r.id} reminder={r} onDelete={() => deleteReminder(r.id)} muted />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function ReminderRow({
  reminder,
  onDelete,
  muted,
}: {
  reminder: Reminder;
  onDelete: () => void;
  muted?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900',
        muted ? 'opacity-60' : '',
      ].join(' ')}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {reminder.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatWhen(reminder.remind_at)}
          {!muted && <span className="text-gray-400"> · {relative(reminder.remind_at)}</span>}
          {reminder.repeat !== 'none' && (
            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300">
              {REMINDER_REPEAT_LABEL[reminder.repeat]}
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete reminder"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        </svg>
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400 dark:border-gray-800">
      {children}
    </p>
  );
}

function Banner({ tone, children }: { tone: 'amber' | 'gray' | 'red'; children: React.ReactNode }) {
  const tones = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    gray: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  };
  return <div className={`mb-3 rounded-xl border p-3 text-sm ${tones[tone]}`}>{children}</div>;
}
