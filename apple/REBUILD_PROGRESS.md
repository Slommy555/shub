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
| Tasks: schedule/weekly/monthly | `components/todo/{Schedule,Weekly,Monthly}View` | ❌ Phase 1 |
| Tasks: recurrence | `lib/recurrence.ts` | ❌ Phase 1 |
| Categories management | `components/CategoryManager` | ❌ Phase 1 (hook exists) |
| Habits / Focus | `components/focus/*` | ✅ basic (needs streaks + polish) |
| Budget | `components/budget/*`, `hooks/budget/*` | ❌ Phase 3 |
| Workout | `components/workout/*`, `hooks/workout/*` | ❌ Phase 4 |
| Notes | `components/notes/*`, `hooks/notes/*` | ❌ Phase 5 |
| Voice + Claude | `components/voice/*`, `lib/claude*` | ❌ Phase 6 |
| Daily brief | `components/DailyBriefModal`, `hooks/useDailyBriefs` | ❌ Phase 7 |
| Settings (appearance/push/telegram/work) | `components/Settings*`, `settings/*` | ⚠️ partial (theme + push) |

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

_Next session: start **Phase 1 (Tasks views)** — port schedule/weekly/monthly views
from `web/src/components/todo/*`, recurrence (`web/src/lib/recurrence.ts`), and the
CategoryManager. Build every new screen from `components/ui/kit.tsx`._
