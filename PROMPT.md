# Session Spec — Repo Reorg (web/) + New Expo iOS App (apple/)

> Supersedes the previous PROMPT.md (Schedule mobile fix, Budget delete/edit, Telegram brief — complete).
> Reorganize the existing React + Vite + Supabase web app into a `web/` subfolder and create a
> new React Native + Expo iOS app in an `apple/` subfolder. Both share the same Supabase backend.
> iOS app starts with just Tasks and Habits. **Do not break the existing web app at any point.**

## PART 1 — REPO REORGANIZATION
Move the Vite app into `web/`: src/, public/, index.html, vite.config.ts, tailwind.config.js,
postcss.config.js, tsconfig.json, tsconfig.node.json, .env.local, package.json, package-lock.json,
.env.example. Delete node_modules/ and dist/ (reinstall/rebuild inside web/).
Stay at root: supabase/, .git/, .gitignore, README.md, PROMPT.md, PROGRESS.md, CLAUDE.md, .vercel/.
Update .gitignore for both apps. Add root vercel.json:
`{ "buildCommand": "cd web && npm install && npm run build", "outputDirectory": "web/dist",
"installCommand": "cd web && npm install", "framework": "vite" }`
Then `cd web && npm install && npm run build` — confirm it passes. Fix any broken paths.
Fallback: if Vercel breaks, set Root Directory = web in dashboard.

## PART 2 — EXPO SCAFFOLD (apple/)
`npx create-expo-app apple --template blank-typescript`. Deps: expo-router, expo-constants,
expo-linking, expo-status-bar, @supabase/supabase-js, expo-secure-store, expo-haptics,
expo-notifications, @react-native-async-storage/async-storage, react-native-url-polyfill,
nativewind, tailwindcss(dev). NativeWind config (babel plugin, tailwind content globs).
lib/supabase.ts uses SecureStore adapter + EXPO_PUBLIC_ env. apple/.env.local mirrors web keys.
Auth: app/_layout.tsx (session check + onAuthStateChange), components/LoginScreen.tsx (magic link
via signInWithOtp). Nav: app/(tabs)/_layout.tsx bottom tabs Tasks + Habits. Theme: lib/theme.ts +
useTheme() reading user_preferences (realtime), AsyncStorage cache, matching web palette.

## PART 3 — TASKS  (reuse existing tasks table, no schema change)
hooks/useTasks.ts (fetch/filter/realtime; add/toggle/delete/update task + subtasks).
tasks.tsx (FlatList, filter pills All/Active/Done/High, search, FAB, pull-refresh, empty state).
components/tasks/: TaskCard, AddTaskModal, EditTaskModal, SubtaskList.

## PART 4 — HABITS  (reuse existing habits table, check real name, no schema change)
hooks/useHabits.ts (habits + today completions, realtime; add/delete/toggle/update).
habits.tsx (cards, date + "N of M complete", progress bar, add btn, pull-refresh, empty state).
components/habits/: HabitCard, AddHabitModal.

## PART 5 — POLISH
Loading skeletons (animated opacity pulse), empty states, pull-to-refresh (RefreshControl),
haptics (light on task toggle, medium on habit complete), push registration (request perms, save
Expo push token to user_preferences.expo_push_token — new migration).

## MIGRATION
`ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS expo_push_token text;` → npx supabase db push.

## FINAL
cd web && npm run build (confirm). git add . && commit "Reorganize into web/ and apple/, scaffold
Expo iOS app with tasks and habits" && push. Output SETUP CHECKLIST (copy env keys, Expo Go, expo
start, verify Vercel).
