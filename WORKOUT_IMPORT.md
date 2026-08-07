# WORKOUT_IMPORT.md — Import Workouts from Screenshots

Guide for scraping workout screenshots and importing them as templates into the app via Claude Code.

---

## HOW IT WORKS

1. You drop screenshots of workouts into a folder called `workouts/` in the project root
2. You paste the prompt below into Claude Code
3. Claude reads every image in the folder, extracts the workout data, and inserts it directly into Supabase as workout templates
4. Templates appear in your app immediately — no manual entry needed

---

## STEP 1 — PREPARE YOUR SCREENSHOTS

Create a folder called `workouts/` in the project root 
(same level as `web/`, `apple/`, `supabase/`).

```
your-project/
  workouts/          ← put screenshots here
  web/
  apple/
  supabase/
```

Drop in any screenshots of workouts. These can be:
- Photos of handwritten workout plans
- Screenshots from fitness apps (Hevy, Strong, JEFIT etc.)
- Screenshots of spreadsheets or notes
- Photos of gym whiteboards or printed programs
- Screenshots of workout PDFs

**Tips for best results:**
- Make sure text is readable and not blurry
- Crop out unrelated content if possible
- One workout per image works best, but multi-day 
  programs in one image also work
- Name the files descriptively if you want 
  (e.g. push_day.png, leg_day.jpg) — Claude will 
  use the filename as a hint for the template name 
  if the image doesn't have a clear title

Supported formats: .png, .jpg, .jpeg, .webp, .gif

---

## STEP 2 — PASTE THIS PROMPT INTO CLAUDE CODE

```
Read every image file in the workouts/ folder at the 
project root. For each image, use your vision capability 
to extract the workout data, then insert it into Supabase 
as a workout template. Do this for ALL images in the folder 
before finishing.

===========================
FOR EACH IMAGE:
===========================

1. READ THE IMAGE
   Extract the following information:
   - Template name (from the workout title in the image, 
     or from the filename if no title is visible)
   - Notes (any program notes, instructions, or context 
     visible in the image)
   - Exercise list in order, for each exercise:
       - Exercise name (clean it up — e.g. "BB Bench" 
         becomes "Barbell Bench Press")
       - Sets (number)
       - Reps (number — use the first value if a range 
         is given, e.g. "8-12" = 8)
       - Default weight (0 if not specified)
       - Notes (any exercise-specific notes visible, 
         e.g. "superset with X", "tempo 3-1-1", 
         "to failure")
   
   If the image contains multiple workouts (e.g. a full 
   week program), create a separate template for each day.
   
   If you cannot read part of the image clearly, make 
   your best guess and note the uncertainty in the 
   template's notes field.

2. MATCH OR CREATE EXERCISES
   For each exercise name extracted:
   - Query the exercises table: 
     SELECT id, name FROM exercises 
     WHERE user_id = '[current user id]' 
     AND LOWER(name) LIKE LOWER('%[exercise name]%')
   - If a match is found: use that exercise's id
   - If no match found: insert a new exercise record:
       INSERT INTO exercises (user_id, name, muscle_groups, is_custom)
       VALUES ('[user_id]', '[name]', '[inferred muscle groups]', true)
     
     Infer muscle_groups from the exercise name using 
     this mapping (use exact strings):
       chest: bench press, fly, push-up, dip, pec
       front_delts: overhead press, shoulder press, front raise
       side_delts: lateral raise, upright row
       rear_delts: face pull, rear delt, reverse fly
       triceps: tricep, skull crusher, pushdown, dip, close grip
       biceps: curl, chin-up
       upper_back: row, pull, shrug, face pull
       lats: pull-up, pulldown, lat, row
       lower_back: deadlift, good morning, hyperextension
       abs: crunch, plank, sit-up, ab, core, leg raise
       obliques: russian twist, side bend, oblique
       glutes: hip thrust, glute, squat, lunge, deadlift
       quads: squat, leg press, lunge, leg extension, step-up
       hamstrings: deadlift, leg curl, hamstring, rdl
       calves: calf raise, standing calf
       forearms: wrist curl, reverse curl, hammer curl
     
     An exercise can have multiple muscle groups — 
     include all that apply.

3. CREATE THE TEMPLATE
   INSERT INTO workout_templates (user_id, name, notes)
   VALUES ('[user_id]', '[template name]', '[notes]')
   
   Check first: if a template with the same name already 
   exists for this user, skip it and note it in output 
   (do not create duplicates).

4. ADD TEMPLATE EXERCISES
   For each exercise in order:
   INSERT INTO template_exercises 
     (template_id, exercise_id, position, 
      default_sets, default_reps, default_weight)
   VALUES 
     ('[template_id]', '[exercise_id]', [position], 
      [sets], [reps], [weight])
   
   Position starts at 1 and increments by 1 for 
   each exercise.

===========================
AFTER PROCESSING ALL IMAGES:
===========================

Print a summary report:

Images processed: X
Templates created: X
Templates skipped (already existed): X
New exercises created: X
Exercises matched to existing: X

Then list each template created:
  ✓ [Template Name] — X exercises
  ⚠ [Template Name] — skipped, already exists
  ✗ [Template Name] — failed ([reason])

If any image could not be read or data could not be 
extracted, note it clearly so I can fix the image 
and re-run.

Do not git push after this — database inserts only, 
no code changes.
```

---

## STEP 3 — VERIFY IN THE APP

After Claude Code finishes:
1. Open your app
2. Go to the Workout tab
3. Tap "Start from template" or go to Templates
4. Your new templates should appear immediately

If a template looks wrong (wrong exercise, wrong sets/reps):
- Tap the template to edit it directly in the app
- Or fix the screenshot and re-run (Claude will skip 
  templates that already exist, so rename or delete 
  the incorrect one first)

---

## RE-RUNNING FOR NEW SCREENSHOTS

If you add more screenshots later:
- Drop them into the `workouts/` folder
- Re-run the same prompt
- Claude will skip any templates it already created 
  (duplicate check by name) and only process new ones

---

## TIPS FOR SPECIFIC SCREENSHOT TYPES

**Hevy / Strong app screenshots:**
These are clean and Claude reads them very well. 
Just screenshot the template view, not the log view.

**Handwritten notes / whiteboard photos:**
Works well if handwriting is clear. Block letters 
read better than cursive. Make sure lighting is even.

**Spreadsheets:**
Screenshot the whole sheet. Claude handles table 
layouts well. Make sure column headers are visible 
(Exercise, Sets, Reps etc.)

**Multi-page PDFs:**
Screenshot each page separately and name them 
sequentially (program_page1.png, program_page2.png). 
Claude will treat each as a separate image but you 
can note in the template names that they belong 
to the same program.

**Instagram / social media workouts:**
Screenshot the post. Claude can read these fine. 
Just make sure the full exercise list is visible 
in the screenshot — some posts split across 
multiple slides, so screenshot each slide separately.

---

## TROUBLESHOOTING

**"Template already exists" for everything**
The templates were already imported. If you want to 
reimport with updates, delete the existing templates 
in the app first then re-run.

**Exercise created but muscle groups are wrong**
Edit the exercise directly in the app under the 
exercise library, or tell Claude Code:
"Update the muscle groups for [exercise name] 
in the exercises table to [correct groups]"

**Claude couldn't read the image**
Try:
- Taking a higher resolution screenshot
- Cropping tighter to just the workout content
- Increasing brightness/contrast before screenshotting
- Converting to PNG if it was JPEG (less compression)

**Template created but missing some exercises**
Part of the image was unclear. Open the template 
in the app and add the missing exercises manually, 
or retake the screenshot with better lighting/resolution.
