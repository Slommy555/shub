import { useCallback, useEffect, useState } from 'react';
import type { ColorKey } from '../types';

/** A shift's start/end as 24h "HH:MM". end <= start means it crosses midnight. */
export interface WorkShift {
  start: string;
  end: string;
  /** Free-form notes for the shift (shown/edited like a task's notes). */
  notes?: string;
  /** Block color, like a category color. Defaults to gray when unset. */
  color?: ColorKey;
}

export interface VoiceSettings {
  startKeyword: string;
  stopKeyword: string;
  /** Weekdays the user works (0 = Sunday … 6 = Saturday). */
  workDays: number[];
  /** Shift times per weekday (only meaningful for work days). */
  shifts: Record<number, WorkShift>;
  /** Hours of sleep the user needs per day. */
  sleepHours: number;
}

const STORAGE_KEY = 'voiceSettings';
const DEFAULT_SHIFT: WorkShift = { start: '09:00', end: '17:00' };
const DEFAULTS: VoiceSettings = {
  startKeyword: 'start recording',
  stopKeyword: 'done',
  workDays: [],
  shifts: {},
  sleepHours: 8,
};

function load(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      startKeyword: typeof parsed.startKeyword === 'string' ? parsed.startKeyword : DEFAULTS.startKeyword,
      stopKeyword: typeof parsed.stopKeyword === 'string' ? parsed.stopKeyword : DEFAULTS.stopKeyword,
      workDays: Array.isArray(parsed.workDays)
        ? parsed.workDays.filter((n: unknown): n is number => typeof n === 'number')
        : DEFAULTS.workDays,
      shifts: parsed.shifts && typeof parsed.shifts === 'object' ? parsed.shifts : {},
      sleepHours: typeof parsed.sleepHours === 'number' ? parsed.sleepHours : DEFAULTS.sleepHours,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Fired in-tab after a write so other useVoiceSettings instances re-read. */
const SYNC_EVENT = 'voicesettings';

// Exposed so the cross-device sync hook (useWorkScheduleSync) can read/write the
// same localStorage key and trigger every mounted instance to re-read.
export const VOICE_SETTINGS_KEY = STORAGE_KEY;
export const VOICE_SETTINGS_SYNC_EVENT = SYNC_EVENT;

/** The portion of the settings that represents the recurring work schedule.
 *  This is what gets synced to Supabase so it follows the user across devices. */
export interface WorkScheduleSubset {
  workDays: number[];
  shifts: Record<number, WorkShift>;
  sleepHours: number;
}

/** Read the current persisted settings (localStorage), outside of React. */
export function readVoiceSettings(): VoiceSettings {
  return load();
}

/** Pull just the schedule-relevant fields out of a full settings object. */
export function scheduleSubset(s: VoiceSettings): WorkScheduleSubset {
  return { workDays: s.workDays, shifts: s.shifts, sleepHours: s.sleepHours };
}

/**
 * Merge a schedule subset (e.g. arriving from Supabase on another device) into
 * the stored settings, then notify every mounted useVoiceSettings instance so
 * the Schedule views re-render with the synced work shifts. Used by
 * useWorkScheduleSync — the work schedule used to live only in localStorage,
 * which is why work shifts never appeared on a freshly-signed-in phone.
 */
export function writeVoiceSettingsSchedule(sub: WorkScheduleSubset): void {
  if (typeof window === 'undefined') return;
  const cur = load();
  const next: VoiceSettings = {
    ...cur,
    workDays: sub.workDays,
    shifts: sub.shifts,
    sleepHours: sub.sleepHours,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota/availability errors */
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/** Start/stop voice keywords, persisted to localStorage. */
export function useVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings>(load);

  // Keep every mounted instance in sync — voice can update the work schedule
  // while the Settings drawer or Schedule view are also reading it. Only adopt
  // the stored value when it actually differs, so an instance's own write (which
  // also fires the sync event) doesn't trigger an endless re-render loop.
  useEffect(() => {
    const resync = () =>
      setSettings((cur) => {
        const next = load();
        return JSON.stringify(next) === JSON.stringify(cur) ? cur : next;
      });
    window.addEventListener(SYNC_EVENT, resync);
    window.addEventListener('storage', resync);
    return () => {
      window.removeEventListener(SYNC_EVENT, resync);
      window.removeEventListener('storage', resync);
    };
  }, []);

  // Persist synchronously inside the setter so a change survives even when the
  // component that triggered it unmounts in the same tick (e.g. a dialog that
  // saves and immediately closes). Other mounted instances re-read on the event.
  const mutate = useCallback((updater: (s: VoiceSettings) => VoiceSettings) => {
    setSettings((cur) => {
      const next = updater(cur);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota/availability errors */
      }
      // Defer the cross-instance notification so we don't dispatch mid-render.
      queueMicrotask(() => window.dispatchEvent(new Event(SYNC_EVENT)));
      return next;
    });
  }, []);

  const setStartKeyword = useCallback((startKeyword: string) => {
    mutate((s) => ({ ...s, startKeyword }));
  }, [mutate]);

  const setStopKeyword = useCallback((stopKeyword: string) => {
    mutate((s) => ({ ...s, stopKeyword }));
  }, [mutate]);

  const toggleWorkDay = useCallback((day: number) => {
    mutate((s) => {
      const isOn = s.workDays.includes(day);
      const workDays = isOn ? s.workDays.filter((d) => d !== day) : [...s.workDays, day].sort((a, b) => a - b);
      // Seed a default shift the first time a day is enabled.
      const shifts = { ...s.shifts };
      if (!isOn && !shifts[day]) shifts[day] = { ...DEFAULT_SHIFT };
      return { ...s, workDays, shifts };
    });
  }, [mutate]);

  const setShift = useCallback((day: number, patch: Partial<WorkShift>) => {
    mutate((s) => ({
      ...s,
      shifts: { ...s.shifts, [day]: { ...(s.shifts[day] ?? DEFAULT_SHIFT), ...patch } },
    }));
  }, [mutate]);

  const setSleepHours = useCallback((sleepHours: number) => {
    mutate((s) => ({ ...s, sleepHours: Math.max(0, Math.min(24, sleepHours)) }));
  }, [mutate]);

  /** Enable a work day (if needed) and set its shift in one step — used when
   *  applying a confirmed work directive from voice input. */
  const setWorkShift = useCallback((day: number, start: string, end: string) => {
    mutate((s) => {
      const workDays = s.workDays.includes(day)
        ? s.workDays
        : [...s.workDays, day].sort((a, b) => a - b);
      const prev = s.shifts[day];
      return { ...s, workDays, shifts: { ...s.shifts, [day]: { ...prev, start, end } } };
    });
  }, [mutate]);

  return {
    settings,
    setStartKeyword,
    setStopKeyword,
    toggleWorkDay,
    setShift,
    setSleepHours,
    setWorkShift,
  };
}
