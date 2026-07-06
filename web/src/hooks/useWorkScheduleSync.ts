import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { watchUserPrefs } from '../lib/userPrefs';
import type { WorkShift } from './useVoiceSettings';
import {
  VOICE_SETTINGS_SYNC_EVENT,
  readVoiceSettings,
  scheduleSubset,
  writeVoiceSettingsSchedule,
  type WorkScheduleSubset,
} from './useVoiceSettings';

/**
 * Coerce a Supabase `work_schedule` jsonb value into a WorkScheduleSubset, or
 * null when it's missing/garbage. Mirrors the defensive parsing in
 * useVoiceSettings.load so a bad row can never crash the Schedule view.
 */
function normalize(raw: unknown): WorkScheduleSubset | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { workDays?: unknown; shifts?: unknown; sleepHours?: unknown };
  const workDays = Array.isArray(o.workDays)
    ? o.workDays.filter((n: unknown): n is number => typeof n === 'number')
    : [];
  const shifts =
    o.shifts && typeof o.shifts === 'object' ? (o.shifts as Record<number, WorkShift>) : {};
  const sleepHours = typeof o.sleepHours === 'number' ? o.sleepHours : 8;
  return { workDays, shifts, sleepHours };
}

/**
 * Keep the recurring work schedule (work days, per-day shift times, sleep hours)
 * in sync across the user's devices via Supabase `user_preferences.work_schedule`.
 *
 * The schedule has always been persisted only in localStorage, so a work shift
 * configured on desktop never appeared on a phone signed into the same account —
 * the timeline looked blank because the shift data simply wasn't there. This hook
 * (mounted once, at the app root) reconciles that localStorage cache with the
 * server on login, pushes local edits up, and keeps every device live via a
 * realtime subscription. It writes back into the same localStorage key the
 * Schedule views already read, so no component needs to change.
 */
export function useWorkScheduleSync(userId?: string | null): void {
  // The last schedule JSON we know the server holds — guards against echoing a
  // just-received realtime value straight back up (and vice versa).
  const lastSyncedRef = useRef<string | null>(null);

  const persist = (sub: WorkScheduleSubset) => {
    if (!userId) return;
    void supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, work_schedule: sub, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .then(({ error }) => {
        if (error) console.error('Failed to save work schedule:', error.message);
      });
  };

  // On login: adopt the server's schedule, or migrate an existing local one up.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('work_schedule')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled || error) return;
      const remote = normalize((data as { work_schedule?: unknown } | null)?.work_schedule);
      if (remote) {
        lastSyncedRef.current = JSON.stringify(remote);
        writeVoiceSettingsSchedule(remote); // reconcile the localStorage cache
      } else {
        // No server row yet — seed it from whatever this device has locally.
        const local = scheduleSubset(readVoiceSettings());
        if (local.workDays.length) {
          lastSyncedRef.current = JSON.stringify(local);
          persist(local);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Push local edits (from the Schedule dialogs / voice) up to the server. Both
  // the in-tab SYNC event and cross-tab storage event signal a change.
  useEffect(() => {
    if (!userId) return;
    const onLocalChange = () => {
      const sub = scheduleSubset(readVoiceSettings());
      const json = JSON.stringify(sub);
      if (json === lastSyncedRef.current) return; // no real change / our own echo
      lastSyncedRef.current = json;
      persist(sub);
    };
    window.addEventListener(VOICE_SETTINGS_SYNC_EVENT, onLocalChange);
    window.addEventListener('storage', onLocalChange);
    return () => {
      window.removeEventListener(VOICE_SETTINGS_SYNC_EVENT, onLocalChange);
      window.removeEventListener('storage', onLocalChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Realtime: a change made on another device flows down into this one.
  useEffect(() => {
    if (!userId) return;
    return watchUserPrefs(userId, 'workschedule', (row) => {
      const remote = normalize((row as { work_schedule?: unknown }).work_schedule);
      if (!remote) return;
      const json = JSON.stringify(remote);
      if (json === lastSyncedRef.current) return;
      lastSyncedRef.current = json;
      writeVoiceSettingsSchedule(remote);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
