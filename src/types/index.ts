export type Priority = 'high' | 'med' | 'low';

/** A category is now just a name string referencing a user-defined category. */
export type Category = string;

/** How a task/event repeats. null = does not repeat. */
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export const RECURRENCES: Recurrence[] = ['daily', 'weekdays', 'weekly', 'monthly'];

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
};

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
  due_date: string | null; // ISO date — the hard deadline (Canvas)
  scheduled_date: string | null; // ISO date — the day to work on / list under
  start_time: string | null; // "HH:MM" — when set with end_time, renders as a timed block
  end_time: string | null; // "HH:MM"
  recurrence: Recurrence | null; // null = one-off; otherwise repeats from its scheduled day
  position: number;
  created_at: string;
  /** Hydrated client-side; not a column on the tasks table. */
  subtasks: Subtask[];
  /** Set only on virtual repeat occurrences; holds the real (base) task id. */
  occurrence_of?: string;
}

/** A user-defined category row (categories table). */
export interface CategoryRecord {
  id: string;
  user_id: string;
  name: string;
  color: ColorKey;
  position: number;
  created_at: string;
}

export type FilterKind =
  | { type: 'all' }
  | { type: 'active' }
  | { type: 'done' }
  | { type: 'high' }
  | { type: 'category'; value: Category };

// --- colors ---------------------------------------------------------------

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

/** Badge classes per color (static so Tailwind keeps them). */
export const COLOR_STYLES: Record<ColorKey, string> = {
  gray: 'bg-gray-200 text-gray-700 dark:bg-gray-600/40 dark:text-gray-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
};

/** Solid swatch (for color pickers / accents). */
export const COLOR_DOT: Record<ColorKey, string> = {
  gray: 'bg-gray-400',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  green: 'bg-green-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
};

/** Seeded for new users; names match the original fixed categories. */
export const DEFAULT_CATEGORIES: { name: string; color: ColorKey }[] = [
  { name: 'work', color: 'blue' },
  { name: 'personal', color: 'purple' },
  { name: 'school', color: 'green' },
  { name: 'health', color: 'teal' },
  { name: 'other', color: 'gray' },
];

/** Legacy default names (kept for the unused FilterBar/SearchBar). */
export const CATEGORIES: Category[] = DEFAULT_CATEGORIES.map((c) => c.name);

// The `priority` field now represents *time consumption* (how much time a task
// takes). The three stored values are reused; only the labels/meaning changed.
// Ordered short → long for the pickers.
export const PRIORITIES: Priority[] = ['low', 'med', 'high'];

export const PRIORITY_DOT: Record<Priority, string> = {
  high: 'bg-red-500', // a lot of time
  med: 'bg-amber-500', // some time
  low: 'bg-green-500', // quick
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Long',
  med: 'Medium',
  low: 'Quick',
};
