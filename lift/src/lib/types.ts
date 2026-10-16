export const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'other'] as const
export const EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'other'] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]
export type Equipment = (typeof EQUIPMENT)[number]

export interface Exercise {
  id: string
  user_id: string | null
  name: string
  muscle_group: string | null
  equipment: string | null
  is_default: boolean
  created_at: string
}

export interface Template {
  id: string
  user_id: string
  name: string
  day_label: string | null
  notes: string | null
  folder_id: string | null
  created_at: string
}

export interface TemplateFolder {
  id: string
  user_id: string
  name: string
  position: number
  created_at: string
}

export type BodyLogType = 'weight' | 'calories'

export interface BodyLog {
  id: string
  user_id: string
  type: BodyLogType
  value: number
  logged_at: string
  created_at: string
}

export interface TemplateExercise {
  id: string
  template_id: string
  exercise_id: string
  position: number
  default_sets: number
  default_reps: number
  default_weight: number | null
  superset_group_id: string | null
  rest_seconds: number
  notes: string | null
}

export interface Program {
  id: string
  user_id: string
  name: string
  cycle_length: number
  total_weeks: number
  start_date: string | null
  is_active: boolean
  deload_weeks: number[]
  created_at: string
}

export interface ProgramDay {
  id: string
  program_id: string
  day_number: number
  template_id: string | null
  label: string | null
  is_rest: boolean
  position: number
}

export interface WorkoutSession {
  id: string
  user_id: string
  template_id: string | null
  program_day_id: string | null
  name: string | null
  started_at: string
  finished_at: string | null
  notes: string | null
  duration_seconds: number | null
}

export interface WorkoutSet {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  weight: number | null
  reps: number | null
  is_warmup: boolean
  is_failure: boolean
  is_dropset: boolean
  drop_weight: number | null
  drop_reps: number | null
  superset_group_id: string | null
  logged_at: string
}

/* ---------- in-progress session (client state) ---------- */

/** Independent set markers; a set may carry several (e.g. warmup + failure). */
export type SetFlag = 'warmup' | 'failure' | 'drop'
export const SET_FLAGS: SetFlag[] = ['warmup', 'failure', 'drop']

export interface LiveSet {
  id: string
  warmup: boolean
  failure: boolean
  drop: boolean
  weight: number | null
  reps: number | null
  dropWeight: number | null
  dropReps: number | null
  done: boolean
}

export interface LiveExercise {
  key: string
  exerciseId: string
  name: string
  supersetGroupId: string | null
  restSeconds: number
  sets: LiveSet[]
  /** "315 lb × 5" style summary from the previous session, if any */
  lastSummary: string | null
  /** ms timestamp when the final set was ticked; drives the sink-to-bottom order */
  completedAt: number | null
}

export interface TemplateSnapshot {
  exerciseId: string
  name: string
  sets: number
  reps: number
  weight: number | null
}

export interface LiveSession {
  sessionId: string
  templateId: string | null
  programDayId: string | null
  programId: string | null
  name: string
  startedAt: number
  exercises: LiveExercise[]
  snapshot: TemplateSnapshot[]
  restEndsAt: number | null
  restTotal: number
}
