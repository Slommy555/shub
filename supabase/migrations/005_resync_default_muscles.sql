-- ============================================================================
-- Re-sync the default exercise library to the fine-grained muscle taxonomy.
--
-- The seed in 004_workout.sql is idempotent (`where not exists ...`), so once
-- the table was first seeded with the OLD coarse muscle names (chest, triceps,
-- quads, abs, …) the rows were never rewritten when the taxonomy was refactored
-- to the granular keys used by MUSCLE_LABELS in src/types/workout.ts. Stale keys
-- have no label and render as empty badges in the exercise picker.
--
-- This migration UPDATES muscle_groups by name (no deletes), so it preserves the
-- exercise ids referenced by template_exercises / workout_sets and leaves any
-- user custom exercises (is_custom = true) untouched.
-- ============================================================================
update public.exercises e
set muscle_groups = v.mg
from (
  values
    ('Barbell Bench Press',       array['mid_chest','front_delts','triceps_lateral']),
    ('Incline Dumbbell Press',    array['upper_chest','front_delts','triceps_lateral']),
    ('Dumbbell Bench Press',      array['mid_chest','front_delts','triceps_lateral']),
    ('Push-Up',                   array['mid_chest','front_delts','triceps_lateral']),
    ('Cable Fly',                 array['mid_chest','lower_chest']),
    ('Dumbbell Pullover',         array['lats','lower_chest','serratus']),
    ('Pull-Up',                   array['lats','teres','biceps']),
    ('Lat Pulldown',              array['lats','teres','biceps']),
    ('Bent-Over Barbell Row',     array['lats','rhomboids','traps_mid','lower_back','biceps']),
    ('Seated Cable Row',          array['lats','rhomboids','traps_mid','biceps']),
    ('T-Bar Row',                 array['lats','rhomboids','traps_mid']),
    ('Barbell Shrug',             array['traps_upper','traps_mid']),
    ('Deadlift',                  array['lower_back','glutes','hamstrings','traps_upper','forearm_flexors']),
    ('Face Pull',                 array['rear_delts','traps_mid','rhomboids']),
    ('Y-Raise',                   array['traps_lower','traps_mid','rear_delts']),
    ('Overhead Barbell Press',    array['front_delts','side_delts','triceps_long']),
    ('Dumbbell Shoulder Press',   array['front_delts','side_delts','triceps_long']),
    ('Arnold Press',              array['front_delts','side_delts','triceps_long']),
    ('Dumbbell Lateral Raise',    array['side_delts']),
    ('Front Raise',               array['front_delts','upper_chest']),
    ('Rear Delt Fly',             array['rear_delts']),
    ('Barbell Curl',              array['biceps','brachialis','forearm_flexors']),
    ('Dumbbell Curl',             array['biceps','brachialis']),
    ('Hammer Curl',               array['brachialis','forearm_flexors','biceps']),
    ('Preacher Curl',             array['biceps','brachialis']),
    ('Concentration Curl',        array['biceps']),
    ('Tricep Pushdown',           array['triceps_lateral','triceps_medial']),
    ('Overhead Tricep Extension', array['triceps_long','triceps_medial']),
    ('Skull Crusher',             array['triceps_long','triceps_lateral']),
    ('Close-Grip Bench Press',    array['triceps_lateral','mid_chest','front_delts']),
    ('Dips',                      array['lower_chest','triceps_lateral','front_delts']),
    ('Wrist Curl',                array['forearm_flexors']),
    ('Reverse Wrist Curl',        array['forearm_extensors']),
    ('Farmer''s Carry',           array['forearm_flexors','traps_upper','glutes']),
    ('Barbell Back Squat',        array['quads_rectus','quads_lateral','quads_medial','glutes','lower_back']),
    ('Front Squat',               array['quads_rectus','quads_lateral','quads_medial','glutes']),
    ('Leg Press',                 array['quads_lateral','quads_medial','glutes','hamstrings']),
    ('Romanian Deadlift',         array['hamstrings','glutes','lower_back']),
    ('Leg Extension',             array['quads_rectus','quads_lateral','quads_medial']),
    ('Leg Curl',                  array['hamstrings']),
    ('Walking Lunge',             array['quads_rectus','glutes','hamstrings','adductors']),
    ('Hip Thrust',                array['glutes','hamstrings']),
    ('Hip Adductor Machine',      array['adductors']),
    ('Standing Calf Raise',       array['calves_gastroc','calves_soleus']),
    ('Seated Calf Raise',         array['calves_soleus']),
    ('Tibialis Raise',            array['tibialis']),
    ('Plank',                     array['upper_abs','lower_abs','obliques']),
    ('Hanging Leg Raise',         array['lower_abs','obliques']),
    ('Cable Crunch',              array['upper_abs','lower_abs']),
    ('Russian Twist',             array['obliques','upper_abs']),
    ('Back Extension',            array['lower_back','glutes']),
    ('Hyperextension',            array['lower_back','glutes','hamstrings'])
) as v(name, mg)
where e.name = v.name
  and e.is_custom = false
  and e.muscle_groups is distinct from v.mg;
