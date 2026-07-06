import type { Priority } from './index';

export type VoiceState = 'idle' | 'recording' | 'review';

/** A task proposed by Claude, editable before the user confirms. */
export interface ProposedTask {
  id: string;
  text: string;
  category: string;
  priority: Priority;
  due_date: string | null; // hard deadline
  scheduled_date: string | null; // day to work on / list under
  start_time: string | null; // "HH:MM" — set for timed events (hike, appointment)
  end_time: string | null; // "HH:MM"
  subtasks: string[];
  /** Per-field clarifying questions Claude was unsure about. */
  unsure: Record<string, string>;
}

/** A recurring work-schedule change Claude proposes, applied to voice settings. */
export interface ProposedWorkShift {
  id: string;
  weekdays: number[]; // 0 = Sunday … 6 = Saturday
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

/** A move Claude proposes for an EXISTING task to make room for new ones. */
export interface ProposedReschedule {
  id: string;
  taskId: string;
  taskText: string;
  from: string | null; // current scheduled day
  to: string | null; // proposed new day
  reason: string;
}

/** A deletion Claude proposes for an EXISTING task the user no longer needs. */
export interface ProposedDeletion {
  id: string;
  taskId: string;
  taskText: string;
  reason: string;
}
