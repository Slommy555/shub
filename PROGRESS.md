# Session Progress

## Part 1 — Repo Reorganization
- [x] Move existing web app files into web/ subfolder (git mv preserved history;
      .env.local moved; root node_modules + dist deleted)
- [x] Update Vercel config to point to web/ directory (root vercel.json Option A;
      .vercel link stays at root so deploy is unaffected)
- [x] Confirm web app still builds and deploys correctly (npm install + npm run
      build pass in web/ — 829 modules, built in 4.4s)
- [x] Update any relative paths broken by the move (none — Vite resolves relative
      to web/; no hardcoded absolute paths)

## Part 2 — Expo App Scaffold
- [ ] Initialize Expo app in apple/ directory
- [ ] Install and configure dependencies
- [ ] Supabase client configured
- [ ] Auth flow (magic link login)
- [ ] Navigation structure (bottom tabs)
- [ ] Theme (dark/light mode synced with Supabase)

## Part 3 — Tasks Feature
- [ ] Task list screen
- [ ] Add task form
- [ ] Task card component (checkbox, priority, category, due date)
- [ ] Subtasks
- [ ] Edit task inline
- [ ] Real-time sync with Supabase

## Part 4 — Habits Feature
- [ ] Habits list screen
- [ ] Habit card with today's completion toggle
- [ ] Add/edit/delete habits
- [ ] Real-time sync with Supabase

## Part 5 — Polish
- [ ] Loading skeletons
- [ ] Empty states
- [ ] Pull to refresh
- [ ] Haptic feedback on completions
- [ ] Push notification registration (Expo notifications)

## Final Steps
- [ ] npm run build passes for web/ app
- [ ] Expo app runs in Expo Go on iPhone
- [ ] Git pushed
