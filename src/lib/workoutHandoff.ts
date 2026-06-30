// A tiny localStorage hand-off so the voice assistant can ask the Workout tab to
// start a session. The voice controller writes a command + navigates to the
// Workout tab; WorkoutTab reads and clears it on mount (it already restores
// sessions from localStorage, so this fits the existing pattern).

const KEY = 'pendingWorkoutStart';

export type WorkoutCommand =
  | { mode: 'freestyle' }
  | { mode: 'template'; name: string };

export function setPendingWorkout(cmd: WorkoutCommand): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cmd));
  } catch {
    /* ignore */
  }
}

export function readPendingWorkout(): WorkoutCommand | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WorkoutCommand) : null;
  } catch {
    return null;
  }
}

export function clearPendingWorkout(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
