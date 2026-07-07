# iOS App Rebuild — Progress & Roadmap

Goal: rebuild the Expo/iOS app (`apple/`) to the `UI_SKILL.md` design system and
re-incorporate **every** feature from the web PWA (`web/`). This is a multi-session
effort. This file is the source of truth for resuming — update it at the end of
every working session.

> **How to resume:** read this file, then `TaskList` (phases are tracked tasks 1–8),
> pick the lowest-numbered incomplete phase, and continue. The design system is
> `apple/lib/theme.tsx` + `apple/components/ui/*`. Match `UI_SKILL.md` for every
> new component.

---

## Design system (source of truth)
- Spec: `../UI_SKILL.md` (dark lavender / "deep space, quiet luxury").
- Tokens live in `apple/lib/theme.tsx` (`Palette`). Existing screens read
  `colors.*`, so a token swap re-skins them automatically.
- Shared primitives: `apple/components/ui/*` (Card, PrimaryButton, Input, Badge,
  Checkbox, Fab, BottomSheet, SectionHeader, Divider, EmptyState, Skeleton).
  **Always build new screens from these, not raw Views.**

## ⚠️ ACCOUNT / DATA (read first if "no data shows")
The phone currently signs into `brandonmoran603@gmail.com` (via `EXPO_PUBLIC_DEV_*`
in `apple/.env.local`) — a **fresh, empty** account (verified 0 tasks / 0 habits).
The real PWA data is under **`tracidyann@gmail.com`**. Nothing will show or sync
with the web app until the phone logs into the SAME account.
**Fix (no data loss):** on the web PWA (signed in as tracidyann via magic link),
use the app's "Set a password" feature to give that account a password, then set
`EXPO_PUBLIC_DEV_EMAIL=tracidyann@gmail.com` + that password in `apple/.env.local`
and restart with `npx expo start -c`. Do NOT delete/recreate tracidyann (that
orphans the data).

## Architecture notes / gotchas
- Auth: single-username gate (`Slommy Dev`) → signs into Supabase via
  `EXPO_PUBLIC_DEV_*` env (see `components/LoginScreen.tsx`). Data is RLS-scoped
  to the signed-in user, shared with the web app (same Supabase project
  `cntmsrztqgejgavrsdfp`).
- Expo SDK **54** (pinned to the iPhone's Expo Go). Don't bump without checking
  Expo Go support.
- LLM (Claude) calls must go through the `anthropic-proxy` Supabase Edge Function
  (server-side key). See root memory `llm-and-usda-direct-browser`.
- Web-only tech that needs native replacements when porting:
  - TipTap notes editor → native editor (plain multiline + markdown, or 10tap).
  - Browser `SpeechRecognition` (voice) → expo record + transcribe, or
    `@react-native-voice/voice`.
  - Recharts/SVG charts → `react-native-svg` (+ `victory-native` if wanted).
- Data hooks already ported to apple: `useTasks`, `useHabits`, `useCategories`,
  `useAuth`, `usePushRegistration`. The web hooks under `web/src/hooks/**` are the
  reference implementations for everything still to port.

---

## Feature inventory (web PWA → iOS status)

| Domain | Web source | iOS status |
|---|---|---|
| Design tokens / UI kit | `UI_SKILL.md` | ✅ **Phase 0 done** (theme.tsx + components/ui/kit.tsx) |
| Tasks: list + filters | `components/todo/TodoView` | ✅ basic (needs UI_SKILL polish) |
| Tasks: multi-day grouping | `components/todo/TodoView` | ✅ day sections (Overdue/Today/Tomorrow/…) |
| Tasks: schedule (day timeline) | `components/todo/ScheduleView` | ✅ Schedule tab + **work-shift overlay** (read-only, synced from PWA) |
| Tasks: time-block editing | form | ✅ start/end time in task form → persists + shows on Schedule |
| Tasks: weekly/monthly views | `components/todo/{Weekly,Monthly}View` | ❌ still TODO |
| Tasks: recurrence | `lib/recurrence.ts` | ❌ Phase 1 |
| Categories management | `components/CategoryManager` | ✅ CategoryManager in Settings (add/rename/recolor/delete, cascades to tasks) |
| Habits / Focus | `components/focus/*` | ✅ basic (needs streaks + polish) |
| Budget | `components/budget/*`, `hooks/budget/*` | ❌ Phase 3 |
| Workout | `components/workout/*`, `hooks/workout/*` | ❌ Phase 4 |
| Notes | `components/notes/*`, `hooks/notes/*` | ❌ Phase 5 |
| Voice + Claude | `components/voice/*`, `lib/claude*` | ❌ Phase 6 |
| Daily brief | `components/DailyBriefModal`, `hooks/useDailyBriefs` | ❌ Phase 7 |
| Settings (appearance/push/telegram/work) | `components/Settings*`, `settings/*` | ⚠️ partial — **Settings tab + Theme editor done** (mode + custom_colors, synced); push partial; telegram/work TODO |

---

## Session log

### Session 1 (2026-07-05) — Phase 0 DONE
- Set up 8 tracked phase tasks + this roadmap.
- Rewrote `lib/theme.tsx` to the full UI_SKILL dark-lavender token system
  (bg/surface/surfaceAlt/overlay, accent/accentMuted/accentSubtle, text/muted/
  textTertiary, border/borderStrong, success/warning/danger/info) for dark+light.
  Existing screens read `colors.*` so they re-skinned automatically.
- Built `components/ui/kit.tsx`: Card, Button (primary/secondary/destructive pill),
  Input, Badge, Checkbox (accent circle), Fab (accent glow), SectionHeader, Divider,
  PillRow, ScreenTitle + RADIUS/SPACE tokens.
- Re-skinned tab bar (accent active / tertiary inactive, 10px labels).
- Polished TaskCard (3px priority strip, accent circle checkbox, 45% done opacity)
  and HabitCard (28px accent checkbox). tsc clean.

### Session 2 (2026-07-05) — Theme editor + PWA sync
- Added a **Settings tab** (`app/(tabs)/settings.tsx`) + `components/settings/ThemeEditor.tsx`:
  Light/Dark/System selector, a "custom colors" toggle, per-color hex editing with
  preset swatches, reset, and sign-out.
- Extended `lib/theme.tsx` to load + realtime-sync `user_preferences.custom_colors`
  (shape `{enabled, colors:{bg,surface,text,muted,border,accent,accentText}}`) —
  **identical contract + defaults to the web PWA** (`web/src/hooks/useAppearance.ts`),
  so custom palettes sync both ways. `overridePalette()` maps the flat 7-color set
  onto the app's richer tokens. `theme` (light/dark/system) was already synced.
- Verified `custom_colors jsonb` column exists (migration 014). tsc clean.
- NOT verified live (no simulator here) — confirm by changing theme on web and
  watching the phone update, and vice versa.

### Session 3 (2026-07-05) — Phase 1 (tasks views) + account diagnosis
- **Diagnosed "no tasks":** the phone is on an empty account (see ACCOUNT note
  above). Data layer (`useTasks`) is correct; the fix is switching accounts.
- Tasks tab → **multi-day** day-grouped SectionList (`lib/taskOrder.ts`).
- New **Schedule tab** (`app/(tabs)/schedule.tsx`): day timeline + date nav +
  now-line + untimed list. Tabs are now Tasks / Schedule / Habits / Settings.
- Task form (`TaskFormSheet`) gained **start/end time** fields; `useTasks.addTask`
  now persists scheduled_date/start_time/end_time so tasks land on the timeline.
- tsc clean. Still TODO in Phase 1: weekly + monthly views, recurrence,
  CategoryManager, and the work-shift overlay on the Schedule timeline.

### Sessions 4–6 (2026-07-05) — login + Schedule crash fixes (were unlogged)
- Switched login to **email + password** like the PWA (`components/LoginScreen.tsx`).
- Fixed two Schedule crashes: render crash (measure track width via `onLayout`
  instead of `%`-based layout) and a realtime crash (unique channel name per hook
  instance — same fix pattern now used across `useTasks`/`useCategories`).

### Session 7 (2026-07-06) — Phase 1: work-shift overlay
- New read-only hook `hooks/useWorkSchedule.tsx`: loads
  `user_preferences.work_schedule` (jsonb `{workDays, shifts, sleepHours}`,
  migration 023) and keeps it live via a realtime subscription. Defensive
  `normalize()` mirrors the web `useWorkScheduleSync` so a bad row can't crash.
  Editing stays on the PWA (WorkShiftDialog); the phone only overlays.
- Schedule tab now renders the day's recurring **work shift** as a full-width
  background block (behind task columns), colored by the shift's `color` via
  `tint()`, with time range + notes. The visible window and empty-state text
  account for the shift too. tsc clean.

### Session 8 (2026-07-06) — Phase 1: CategoryManager
- Added write ops to `hooks/useCategories.ts` (`addCategory`/`updateCategory`/
  `deleteCategory`) mirroring the web semantics: **rename cascades** to every
  task using the old name; **delete reassigns** its tasks to a fallback category
  and always keeps ≥1 category.
- New `components/settings/CategoryManager.tsx` (mounted in the Settings tab):
  per-row color dot + inline name edit + delete (with confirm Alert), a color
  picker (9 swatches from `COLOR_DOT_HEX`/`COLOR_KEYS`), and an add row. Built
  from `components/ui/kit`. tsc clean.

_Next session: finish Phase 1 (weekly/monthly views + recurrence), then Phase 2
(Habits streaks). Build from `components/ui/kit.tsx`._
