/** One thing you spent money on, logged against a calendar day. */
export interface SpendEntry {
  id: string;
  user_id: string;
  amount: number;
  /** What it was for, or null when the entry was saved without one. */
  label: string | null;
  /** Calendar day the spend counts toward (YYYY-MM-DD). */
  spent_at: string;
  created_at: string;
}
