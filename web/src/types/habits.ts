import type { ColorKey } from './index';

/** A habit is a recurring daily action; a goal is a standing daily target. */
export type HabitKind = 'habit' | 'goal';

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  kind: HabitKind;
  color: ColorKey;
  position: number;
  archived: boolean;
  /** Optional daily push reminder time, "HH:MM" (or null for none). */
  reminder_time: string | null;
  created_at: string;
}

/** One completion: this habit was done on this calendar day (YYYY-MM-DD). */
export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
}
