export type ReminderRepeat = 'none' | 'daily' | 'weekly';

export const REMINDER_REPEATS: ReminderRepeat[] = ['none', 'daily', 'weekly'];

export const REMINDER_REPEAT_LABEL: Record<ReminderRepeat, string> = {
  none: 'Once',
  daily: 'Every day',
  weekly: 'Every week',
};

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  remind_at: string; // ISO timestamp (UTC)
  repeat: ReminderRepeat;
  fired: boolean;
  created_at: string;
}
