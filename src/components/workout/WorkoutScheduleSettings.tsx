import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const REST = '__rest__';
const CUSTOM = '__custom__';

/**
 * Weekly workout planner: one row per weekday, each set to Rest, one of the
 * user's workout templates, or a free-text custom label. Persisted to
 * user_preferences.workout_schedule ({ mon: "Push Day", tue: "Rest", ... }) and
 * read by the daily brief ("Today is Push Day" / "Rest Day"). An empty/absent
 * day means Rest. Auto-saves on every change, like the other settings.
 */
export default function WorkoutScheduleSettings({
  userId,
  templateNames,
}: {
  userId: string;
  templateNames: string[];
}) {
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  // Days the user explicitly put into "Custom" mode (so an empty custom field
  // doesn't snap back to Rest in the dropdown while they're typing).
  const [customDays, setCustomDays] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('workout_schedule')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      const sched = (data?.workout_schedule ?? {}) as Record<string, string>;
      setSchedule(sched);
      // Any saved value that isn't a template name starts life in custom mode.
      const custom: Record<string, boolean> = {};
      for (const { key } of DAYS) {
        const v = sched[key];
        if (v && !templateNames.includes(v)) custom[key] = true;
      }
      setCustomDays(custom);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function persist(next: Record<string, string>) {
    void supabase
      .from('user_preferences')
      .upsert({ user_id: userId, workout_schedule: next }, { onConflict: 'user_id' })
      .then(({ error }) => {
        if (error) console.error('save workout schedule failed:', error.message);
      });
  }

  function setDay(key: string, value: string) {
    setSchedule((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      persist(next);
      return next;
    });
  }

  function onSelect(key: string, choice: string) {
    if (choice === REST) {
      setCustomDays((c) => ({ ...c, [key]: false }));
      setDay(key, '');
    } else if (choice === CUSTOM) {
      setCustomDays((c) => ({ ...c, [key]: true }));
      // keep any existing text; leave the stored value as-is
    } else {
      setCustomDays((c) => ({ ...c, [key]: false }));
      setDay(key, choice);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">Weekly Workout Schedule</h2>
      <p className="mb-3 text-xs text-gray-400">
        Plan each day so your daily brief knows whether it's a training day or a rest day.
      </p>

      {loading ? (
        <div className="py-4 text-center text-xs text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const val = schedule[key] ?? '';
            const isCustom = customDays[key] || (val !== '' && !templateNames.includes(val));
            const selectValue = isCustom ? CUSTOM : val && templateNames.includes(val) ? val : REST;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-sm text-gray-600 dark:text-gray-300">{label}</span>
                <select
                  value={selectValue}
                  onChange={(e) => onSelect(key, e.target.value)}
                  aria-label={`${label} workout`}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                >
                  <option value={REST}>Rest</option>
                  {templateNames.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value={CUSTOM}>Custom…</option>
                </select>
                {isCustom && (
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setDay(key, e.target.value)}
                    placeholder="e.g. Push Day"
                    aria-label={`${label} custom workout`}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
