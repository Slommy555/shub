# Nutrition Label Scanner Tab — Claude Code Prompt

> Supersedes the previous PROMPT.md (Budget Fixes Round 2 — complete).

## FIRST THING TO DO — SESSION MANAGEMENT

Before doing anything else:

1. Check if PROMPT.md exists at the project root — save this
   prompt there if not, commit and push.
2. Check if PROGRESS.md exists — create it if not with all
   items unchecked, commit and push.
   If it exists, resume from first incomplete item.

PROGRESS.md format:
# Session Progress

## Nutrition Scanner Tab
- [ ] Supabase schema + migration
- [ ] New tab added to navigation
- [ ] Camera/image upload UI
- [ ] Claude vision API call (via anthropic-proxy Edge Function)
- [ ] Macro result card with edit fields
- [ ] Add to daily total flow
- [ ] Daily total strip
- [ ] Log history (today's entries)
- [ ] Build passing + git pushed

After completing each item:
  git add PROGRESS.md && git commit -m "Progress: [item] complete" && git push

To resume: "Read PROMPT.md and PROGRESS.md and resume where you left off."

---

Add a Nutrition Scanner tab to the app. The user takes or
uploads a photo of a nutrition label, inputs how much they
ate, and Claude reads the label and calculates the macros
for that serving. They can edit the result then add it to
a simple daily running total. Follow UI_SKILL.md for all
visual decisions.

===========================
SUPABASE SCHEMA
===========================

New migration file 00X_nutrition_scanner.sql:

nutrition_logs:
  id: uuid primary key default gen_random_uuid()
  user_id: uuid references auth.users
  food_name: text nullable (Claude's best guess at the food name)
  calories: numeric not null default 0
  protein_g: numeric not null default 0
  carbs_g: numeric not null default 0
  fat_g: numeric not null default 0
  serving_size: text nullable (e.g. "1 cup", "100g", "2 slices")
  logged_at: date not null default current_date
  created_at: timestamptz default now()

nutrition_goals:
  id: uuid primary key default gen_random_uuid()
  user_id: uuid references auth.users unique
  calories: numeric default 2000
  protein_g: numeric default 150
  carbs_g: numeric default 200
  fat_g: numeric default 65

Enable RLS on both tables.

===========================
TAB
===========================

Add a new "Nutrition" tab to the main navigation.
Icon: use a Lucide "scan-line" or "camera" icon.
Place it between existing tabs in whatever position
makes sense in the current nav order.

===========================
TAB LAYOUT — THREE SECTIONS
===========================

SECTION 1 — DAILY TOTAL STRIP (top, always visible)
  A horizontal strip at the top of the tab showing
  today's running totals:

  Calories    Protein    Carbs      Fat
  1,240       87g        143g       32g

  - Pull from sum of all nutrition_logs for today
    (logged_at = today)
  - Four values, equal width columns
  - Large bold numbers (text-2xl weight 700)
  - Small muted labels below (text-xs --color-text-secondary)
  - Tap the strip to open a simple goal-setting sheet:
      Four inputs: Calorie goal, Protein goal (g),
      Carbs goal (g), Fat goal (g)
      Saves to nutrition_goals table
      If goals are set, show progress under each number:
      e.g. "1,240 / 2,000" with a thin progress bar
  - Updates in real time as entries are added

SECTION 2 — SCANNER (middle, main interaction)

  STATE 1 — IDLE:
    Large centered area with two options:

    [Camera icon]          [Upload icon]
    Take Photo             Upload Image

    Both are large tappable cards (~140px tall each),
    side by side on desktop, stacked on mobile.
    Subtle border, --color-bg-elevated background.

    Below the two options, a text input:
    "Amount eaten" — placeholder: "e.g. 1 cup, 100g,
    2 slices, half the bag"
    This is free text — the user describes how much
    they ate in natural language.

    Camera button: opens device camera
    (use input type="file" accept="image/*" capture="environment"
    for PWA/mobile compatibility — do NOT use any Capacitor
    camera plugin since this is a web PWA)

    Upload button: opens file picker for images
    (input type="file" accept="image/*")

  STATE 2 — IMAGE SELECTED:
    Show a preview of the selected image
    (fit within the scanner area, max height 300px,
    object-fit: contain, rounded corners --radius-lg)

    The "Amount eaten" input remains visible below
    the preview.

    A "Scan Label" button below the input — prominent,
    primary style (full width, lavender, pill shape).

    An "X" button top right of the image preview
    to clear and go back to STATE 1.

  STATE 3 — SCANNING:
    Show a skeleton loader in place of the result card.
    Scanning status text: "Reading label..." in
    --color-text-secondary.
    Do not show the image or inputs while scanning.

  STATE 4 — RESULT:
    Show a result card with editable fields:

    - All four macro values are editable number inputs
    - Food name is an editable text input at the top
    - Serving size shown as static text (what user typed)
    - "Edit" button: makes all fields editable if not
      already (they should be editable by default —
      the Edit button just makes it visually clear
      they can be changed)
    - "Add to my day" button: saves current values
      to nutrition_logs, clears the scanner back to
      STATE 1, updates the daily total strip instantly
    - "Scan another" link below the card: goes back
      to STATE 1 without adding

    If Claude could not read the label (bad photo,
    not a nutrition label, etc): show an error state:
    "Couldn't read this label — try a clearer photo
    or better lighting"
    with a "Try again" button that goes back to STATE 1

SECTION 3 — TODAY'S LOG (bottom, scrollable)
  Header: "Today" with the current date on the right

  A simple list of everything logged today:

  [Food name]              [Calories]
  [P: Xg  C: Xg  F: Xg]

  - Each entry has a delete button (trash icon, right side)
  - Swipe left on mobile to delete
  - Deleting an entry updates the daily total strip
    instantly
  - If nothing logged yet: "Nothing logged yet today"
    in --color-text-tertiary, centered, no emoji
  - Tap an entry to edit it (opens same result card
    layout in a bottom sheet with current values
    pre-filled, "Save changes" button)

===========================
CLAUDE VISION API CALL
===========================

When "Scan Label" is tapped:

1. Convert the selected image to base64
2. Call the existing anthropic-proxy Supabase Edge Function
   with the following:

   Model: claude-sonnet-4-6
   Max tokens: 1000

   Messages:
   [
     {
       role: "user",
       content: [
         {
           type: "image",
           source: {
             type: "base64",
             media_type: "[image/jpeg or image/png etc]",
             data: "[base64 string]"
           }
         },
         {
           type: "text",
           text: "This is a photo of a nutrition label.
           The person ate: [amount eaten text from input].

           Read the nutrition label and calculate the
           macros for the amount they ate. Account for
           the serving size on the label vs how much
           they actually ate.

           For example: if the label says 200 calories
           per 100g and they ate 150g, the answer is
           300 calories.

           Return ONLY a JSON object with no other text:
           {
             food_name: string (your best guess at what
               this food is from the label, or 'Unknown Food'),
             calories: number,
             protein_g: number,
             carbs_g: number,
             fat_g: number,
             confidence: 'high' | 'medium' | 'low',
             note: string or null (any caveat, e.g.
               'Label was partially obscured' or null)
           }"
         }
       ]
     }
   ]

3. Parse the JSON response
4. If confidence is 'low' or note is not null:
   show the note as a small amber warning below
   the result card so the user knows to double-check
5. If JSON parsing fails or response is not valid:
   show the error state

NOTE: The anthropic-proxy Edge Function must support
image content in the messages array. If it currently
only handles text messages, update it to pass through
the full messages array as-is to the Anthropic API
without stripping image content blocks. The Anthropic
API already supports vision — just make sure the proxy
isn't filtering out non-text content types.

===========================
IMAGE HANDLING
===========================

Before sending to Claude:
  - Resize/compress the image client-side if it exceeds
    1MB — use the Canvas API to resize to max 1200px
    on the longest side at 85% JPEG quality
  - This keeps API calls fast and within size limits
  - Show a brief "Preparing image..." toast if
    compression takes more than 500ms

Do NOT store images in Supabase Storage — only store
the extracted macro numbers in nutrition_logs. Images
are ephemeral and only used for the Claude call.

===========================
MOBILE SPECIFIC
===========================

On mobile (below 640px):
  - Camera and Upload options stack vertically,
    full width each
  - Image preview: max height 250px
  - Result card: full width, inputs large enough
    to tap easily (min 44px height)
  - Today's log: full width cards
  - Daily total strip: numbers slightly smaller
    (text-xl instead of text-2xl) to fit 4 columns

===========================
SUPABASE MIGRATIONS
===========================

After creating migration file:
  npx supabase db push
If duplicate key error: npx supabase migration list,
skip already-applied ones.

===========================
AUTO DEPLOY
===========================

After everything is complete and npm run build passes:
1. git add .
2. git commit -m "Add nutrition label scanner tab"
3. git push
Do not push if build fails. Confirm push succeeded.

===========================
OUTPUT
===========================
Report each section with ✓ or ✗.
Specifically confirm:
  - Camera capture works on mobile (input with capture attribute)
  - Image is compressed before sending to Claude
  - anthropic-proxy correctly passes image content to Anthropic API
  - Macros update the daily total strip immediately on add
  - Delete also updates the strip immediately
