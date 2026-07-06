// ============================================================================
// Workout Logger types — mirrors the tables in supabase/migrations/004_workout.sql
// ============================================================================

export type MuscleGroup =
  // chest
  | 'upper_chest'
  | 'mid_chest'
  | 'lower_chest'
  // shoulders
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  // back
  | 'traps_upper'
  | 'traps_mid'
  | 'traps_lower'
  | 'rhomboids'
  | 'lats'
  | 'teres'
  | 'lower_back'
  // arms
  | 'biceps'
  | 'brachialis'
  | 'triceps_long'
  | 'triceps_lateral'
  | 'triceps_medial'
  | 'forearm_flexors'
  | 'forearm_extensors'
  // core
  | 'upper_abs'
  | 'lower_abs'
  | 'obliques'
  | 'serratus'
  // legs
  | 'glutes'
  | 'quads_rectus'
  | 'quads_lateral'
  | 'quads_medial'
  | 'adductors'
  | 'hamstrings'
  | 'calves_gastroc'
  | 'calves_soleus'
  | 'tibialis';

/** Muscle groups organized by region (used for grouped pickers + ordering). */
export const MUSCLE_REGIONS: { region: string; groups: MuscleGroup[] }[] = [
  { region: 'Chest', groups: ['upper_chest', 'mid_chest', 'lower_chest'] },
  { region: 'Shoulders', groups: ['front_delts', 'side_delts', 'rear_delts'] },
  {
    region: 'Back',
    groups: ['traps_upper', 'traps_mid', 'traps_lower', 'rhomboids', 'lats', 'teres', 'lower_back'],
  },
  {
    region: 'Arms',
    groups: [
      'biceps',
      'brachialis',
      'triceps_long',
      'triceps_lateral',
      'triceps_medial',
      'forearm_flexors',
      'forearm_extensors',
    ],
  },
  { region: 'Core', groups: ['upper_abs', 'lower_abs', 'obliques', 'serratus'] },
  {
    region: 'Legs',
    groups: [
      'glutes',
      'quads_rectus',
      'quads_lateral',
      'quads_medial',
      'adductors',
      'hamstrings',
      'calves_gastroc',
      'calves_soleus',
      'tibialis',
    ],
  },
];

/** The canonical ordered list — use this everywhere a full list is needed. */
export const MUSCLE_GROUPS: MuscleGroup[] = MUSCLE_REGIONS.flatMap((r) => r.groups);

/** Human-readable labels for the muscle group strings. */
export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  upper_chest: 'Upper Chest',
  mid_chest: 'Mid Chest',
  lower_chest: 'Lower Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  traps_upper: 'Upper Traps',
  traps_mid: 'Mid Traps',
  traps_lower: 'Lower Traps',
  rhomboids: 'Rhomboids',
  lats: 'Lats',
  teres: 'Teres',
  lower_back: 'Lower Back (Erectors)',
  biceps: 'Biceps',
  brachialis: 'Brachialis',
  triceps_long: 'Triceps — Long Head',
  triceps_lateral: 'Triceps — Lateral Head',
  triceps_medial: 'Triceps — Medial Head',
  forearm_flexors: 'Forearm Flexors',
  forearm_extensors: 'Forearm Extensors',
  upper_abs: 'Upper Abs',
  lower_abs: 'Lower Abs',
  obliques: 'Obliques',
  serratus: 'Serratus',
  glutes: 'Glutes',
  quads_rectus: 'Rectus Femoris',
  quads_lateral: 'Vastus Lateralis',
  quads_medial: 'Vastus Medialis',
  adductors: 'Adductors',
  hamstrings: 'Hamstrings',
  calves_gastroc: 'Gastrocnemius',
  calves_soleus: 'Soleus',
  tibialis: 'Tibialis',
};

// --- DB row shapes ---------------------------------------------------------

export interface Exercise {
  id: string;
  /** null for the shared default library, set for user-created exercises. */
  user_id: string | null;
  name: string;
  muscle_groups: MuscleGroup[];
  is_custom: boolean;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
}

/** One planned set inside a template exercise. */
export interface TemplateSet {
  reps: number | null;
  weight: number | null;
  type: SetType;
  /** Per-set rest in seconds; null falls back to the exercise's rest_seconds. */
  rest?: number | null;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  default_sets: number | null;
  default_reps: number | null;
  default_weight: number | null;
  rest_seconds: number | null;
  /** Per-set plan; falls back to default_* when empty (legacy templates). */
  sets: TemplateSet[];
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type SetType = 'warmup' | 'normal' | 'failure';

export interface WorkoutSet {
  id: string;
  log_id: string;
  exercise_id: string;
  set_number: number;
  weight_lbs: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  set_type: SetType;
  completed_at: string;
}

export interface BodyWeightLog {
  id: string;
  user_id: string;
  weight_lbs: number;
  logged_at: string; // ISO date (YYYY-MM-DD)
  notes: string | null;
}

// --- Derived / composite shapes -------------------------------------------

/** A template with its ordered exercises joined to the exercise records. */
export interface TemplateWithExercises extends WorkoutTemplate {
  exercises: (TemplateExercise & { exercise: Exercise })[];
  last_used_at?: string | null;
  exercise_count?: number;
}

/** A completed session with its sets hydrated. */
export interface WorkoutLogWithSets extends WorkoutLog {
  sets: WorkoutSet[];
}

// --- Client-side active session (before it is persisted) -------------------

export interface SessionSet {
  /** client-generated id; becomes the workout_sets row id on save. */
  id: string;
  weight_lbs: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string;
  type: SetType;
  done: boolean;
  /** Per-set rest override in seconds; null falls back to the exercise rest. */
  rest?: number | null;
}

export interface SessionExercise {
  /** client-generated key for list rendering + drag reorder. */
  key: string;
  exercise: Exercise;
  /** Rest between sets in seconds; null falls back to DEFAULT_REST_SECONDS. */
  restSeconds: number | null;
  /** One free-text note for the whole exercise (not per set). Persisted onto the
   *  first saved set's `notes` column on finish (no exercise-level table). */
  notes: string;
  sets: SessionSet[];
}

export interface ActiveSession {
  templateId: string | null;
  name: string;
  startedAt: string; // ISO timestamp
  exercises: SessionExercise[];
}

/** Summary computed when finishing a workout. */
export interface WorkoutSummary {
  totalVolume: number;
  totalSets: number;
  exerciseCount: number;
  durationMs: number;
  muscleGroups: MuscleGroup[];
}

// --- Metrics shapes --------------------------------------------------------

export type MuscleSetCounts = Record<string, number>;

export interface ExercisePR {
  weight_lbs: number;
  reps: number;
  date: string; // ISO timestamp
}

export type VolumeRange = 'week' | '4weeks' | '3months';
export type WeightView = 'daily' | 'weekly' | 'monthly';
