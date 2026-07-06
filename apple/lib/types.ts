// Shared row types — mirror the web app's Supabase schema exactly so both
// clients read/write the same tables. See web/src/types.

export type Priority = 'high' | 'med' | 'low';
export type Category = string;
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  task_id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface Task {
  id: string;
  user_id: string;
  text: string;
  notes: string | null;
  category: Category;
  priority: Priority;
  done: boolean;
  due_date: string | null; // ISO date
  scheduled_date: string | null; // ISO date
  start_time: string | null; // "HH:MM"
  end_time: string | null; // "HH:MM"
  recurrence: Recurrence | null;
  position: number;
  created_at: string;
  /** Hydrated client-side; not a column on the tasks table. */
  subtasks: Subtask[];
}

export type HabitKind = 'habit' | 'goal';

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  kind: HabitKind;
  color: ColorKey;
  position: number;
  archived: boolean;
  reminder_time: string | null; // "HH:MM"
  created_at: string;
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
}

export interface CategoryRecord {
  id: string;
  user_id: string;
  name: string;
  color: ColorKey;
  position: number;
  created_at: string;
}

// --- colors (mirror web palette) ------------------------------------------

export type ColorKey =
  | 'gray'
  | 'red'
  | 'amber'
  | 'green'
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink';

export const COLOR_KEYS: ColorKey[] = [
  'gray', 'red', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink',
];

export const PRIORITIES: Priority[] = ['low', 'med', 'high'];

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Long',
  med: 'Medium',
  low: 'Quick',
};

/** Solid swatch per priority (matches web PRIORITY_DOT). */
export const PRIORITY_HEX: Record<Priority, string> = {
  high: '#ef4444', // red-500  — a lot of time
  med: '#f59e0b', // amber-500 — some time
  low: '#22c55e', // green-500 — quick
};

export const DEFAULT_CATEGORIES: { name: string; color: ColorKey }[] = [
  { name: 'work', color: 'blue' },
  { name: 'personal', color: 'purple' },
  { name: 'school', color: 'green' },
  { name: 'health', color: 'teal' },
  { name: 'other', color: 'gray' },
];
