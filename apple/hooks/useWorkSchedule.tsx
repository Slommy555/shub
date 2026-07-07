import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ColorKey } from '../lib/types';

/** One recurring shift for a weekday. Mirrors web's `WorkShift`. */
export interface WorkShift {
  start: string;
  end: string;
  notes?: string;
  color?: ColorKey;
}

/**
 * The recurring work schedule as stored in `user_preferences.work_schedule`
 * (jsonb). Same shape the web PWA persists via `useWorkScheduleSync`:
 *   { workDays: number[], shifts: { <dow>: WorkShift }, sleepHours: number }
 * `workDays` uses 0 = Sunday … 6 = Saturday.
 */
export interface WorkSchedule {
  workDays: number[];
  shifts: Record<number, WorkShift>;
  sleepHours: number;
}

const EMPTY: WorkSchedule = { workDays: [], shifts: {}, sleepHours: 8 };

/**
 * Defensively coerce a Supabase `work_schedule` jsonb value into a WorkSchedule.
 * A garbage row can never crash the Schedule view — it just reads as empty.
 * Mirrors `normalize` in web/src/hooks/useWorkScheduleSync.ts.
 */
function normalize(raw: unknown): WorkSchedule {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const o = raw as { workDays?: unknown; shifts?: unknown; sleepHours?: unknown };
  const workDays = Array.isArray(o.workDays)
    ? o.workDays.filter((n): n is number => typeof n === 'number')
    : [];
  const shifts =
    o.shifts && typeof o.shifts === 'object' ? (o.shifts as Record<number, WorkShift>) : {};
  const sleepHours = typeof o.sleepHours === 'number' ? o.sleepHours : 8;
  return { workDays, shifts, sleepHours };
}

/**
 * Read-only view of the user's recurring work schedule, kept live via the same
 * realtime `user_preferences` row the theme + custom colors already sync
 * through. Editing lives on the web PWA (WorkShiftDialog) for now; the phone
 * just overlays the shift onto the Schedule timeline.
 */
export function useWorkSchedule(userId: string | null) {
  const [schedule, setSchedule] = useState<WorkSchedule>(EMPTY);
  // Unique per instance so this channel never collides with the theme /
  // categories / tasks subscriptions on the same user_preferences table.
  const channelIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!userId) {
      setSchedule(EMPTY);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('work_schedule')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled || error) return;
      setSchedule(normalize((data as { work_schedule?: unknown } | null)?.work_schedule));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`workschedule-rt-${userId}-${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { work_schedule?: unknown } | undefined;
          setSchedule(normalize(row?.work_schedule));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { schedule };
}
