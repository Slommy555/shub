import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Reminder, ReminderRepeat } from '../types/reminders';
import { scheduleReminderTrigger, showReminderNow, triggersSupported } from '../lib/notifications';

const TICK_MS = 15_000;
const DAY_MS = 86_400_000;

const byRemindAt = (a: Reminder, b: Reminder) =>
  a.remind_at < b.remind_at ? -1 : a.remind_at > b.remind_at ? 1 : 0;

/** Advance a repeating reminder's time past `now` to its next occurrence. */
function nextOccurrence(fromMs: number, repeat: ReminderRepeat, nowMs: number): number {
  const step = repeat === 'weekly' ? 7 * DAY_MS : DAY_MS;
  let t = fromMs;
  // Jump forward in whole steps until it's in the future.
  if (t <= nowMs) {
    const missed = Math.floor((nowMs - t) / step) + 1;
    t += missed * step;
  }
  return t;
}

/**
 * Loads the user's reminders, keeps them in sync, exposes CRUD, and runs the
 * delivery scheduler. Mount this once at the app shell so reminders fire on any
 * tab. Foreground delivery uses an in-app timer; when the Notification Triggers
 * API is available (Chromium) it additionally schedules notifications that fire
 * even if the app is closed.
 */
export function useScheduledReminders(userId: string | null) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const remindersRef = useRef<Reminder[]>([]);
  remindersRef.current = reminders;
  // Session guard against firing the same occurrence twice (key = id@remind_at).
  const firedRef = useRef<Set<string>>(new Set());
  // Triggers we've already scheduled this session (key = id@remind_at).
  const scheduledRef = useRef<Set<string>>(new Set());

  // --- load ---------------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setReminders([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error: err } = await supabase
        .from('reminders')
        .select('*')
        .order('remind_at', { ascending: true });
      if (cancelled) return;
      if (err) {
        console.error('Failed to load reminders:', err.message);
        setError(
          /relation .*reminders.* does not exist|could not find the table/i.test(err.message)
            ? 'The reminders table doesn’t exist yet. Run the 010_reminders.sql migration in Supabase.'
            : err.message
        );
      }
      setReminders(((data ?? []) as Reminder[]).sort(byRemindAt));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // --- realtime -----------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`reminders-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setReminders((prev) => prev.filter((r) => r.id !== id));
          } else {
            const row = payload.new as Reminder;
            setReminders((prev) => {
              const exists = prev.some((r) => r.id === row.id);
              const next = exists ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row];
              return next.sort(byRemindAt);
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // --- mutations ----------------------------------------------------------
  const addReminder = useCallback(
    async (input: { title: string; body: string | null; remind_at: string; repeat: ReminderRepeat }) => {
      if (!userId) return;
      const id = crypto.randomUUID();
      const row: Reminder = {
        id,
        user_id: userId,
        title: input.title,
        body: input.body,
        remind_at: input.remind_at,
        repeat: input.repeat,
        fired: false,
        created_at: new Date().toISOString(),
      };
      setReminders((prev) => [...prev, row].sort(byRemindAt));
      setError(null);
      const { error: err } = await supabase.from('reminders').insert({
        id,
        user_id: userId,
        title: row.title,
        body: row.body,
        remind_at: row.remind_at,
        repeat: row.repeat,
      });
      if (err) {
        console.error('addReminder failed:', err.message);
        setReminders((prev) => prev.filter((r) => r.id !== id));
        setError(
          /relation .*reminders.* does not exist|could not find the table/i.test(err.message)
            ? 'The reminders table doesn’t exist yet. Run the 010_reminders.sql migration in Supabase.'
            : `Couldn’t save reminder: ${err.message}`
        );
      }
    },
    [userId]
  );

  const updateReminder = useCallback(
    async (id: string, patch: Partial<Pick<Reminder, 'title' | 'body' | 'remind_at' | 'repeat' | 'fired'>>) => {
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)).sort(byRemindAt));
      const { error: err } = await supabase.from('reminders').update(patch).eq('id', id);
      if (err) console.error('updateReminder failed:', err.message);
    },
    []
  );

  const deleteReminder = useCallback(async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    const { error: err } = await supabase.from('reminders').delete().eq('id', id);
    if (err) console.error('deleteReminder failed:', err.message);
  }, []);

  // --- foreground delivery scheduler -------------------------------------
  useEffect(() => {
    if (!userId) return;

    const tick = () => {
      const now = Date.now();
      for (const r of remindersRef.current) {
        if (r.fired) continue;
        const due = new Date(r.remind_at).getTime();
        const key = `${r.id}@${r.remind_at}`;
        if (due <= now && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          void showReminderNow({ id: r.id, title: r.title, body: r.body });
          if (r.repeat === 'none') {
            void updateReminder(r.id, { fired: true });
          } else {
            const next = nextOccurrence(due, r.repeat, now);
            void updateReminder(r.id, { remind_at: new Date(next).toISOString() });
          }
        }
      }
    };

    tick();
    const interval = window.setInterval(tick, TICK_MS);
    // Re-check when the app regains focus (it may have been backgrounded).
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, updateReminder]);

  // --- background delivery (Chromium Notification Triggers) --------------
  useEffect(() => {
    if (!userId || !triggersSupported()) return;
    const now = Date.now();
    for (const r of reminders) {
      if (r.fired) continue;
      const due = new Date(r.remind_at).getTime();
      const key = `${r.id}@${r.remind_at}`;
      // Schedule near-future reminders (within a day) once.
      if (due > now && due - now <= DAY_MS && !scheduledRef.current.has(key)) {
        scheduledRef.current.add(key);
        void scheduleReminderTrigger({ id: r.id, title: r.title, body: r.body, timestamp: due });
      }
    }
  }, [userId, reminders]);

  return { reminders, loading, error, addReminder, updateReminder, deleteReminder };
}

export type UseScheduledReminders = ReturnType<typeof useScheduledReminders>;
