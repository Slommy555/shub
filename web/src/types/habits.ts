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
  /**
   * Water habits are checked off by logging oz into `water_logs` rather than by
   * tapping a checkbox — see WaterHabitCard. At most one per user.
   */
  is_water_habit: boolean;
  /** Daily target in fluid ounces; only meaningful when `is_water_habit`. */
  water_goal_oz: number | null;
  created_at: string;
}

/** One completion: this habit was done on this calendar day (YYYY-MM-DD). */
export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
}

/** One cup/bottle/glass of water, logged against a water habit on a given day. */
export interface WaterLog {
  id: string;
  user_id: string;
  habit_id: string;
  /** Calendar day the drink counts toward (YYYY-MM-DD). */
  logged_at: string;
  oz: number;
  /** Free-text ("bottle", "glass"), or null for a plain quick-add. */
  label: string | null;
  created_at: string;
}
