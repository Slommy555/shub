# Project Status — Slommy HQ app

_Last updated: 2026-06-23_

A handoff note so you (or Claude) can close the terminal and resume later with
zero guesswork.

---

## TL;DR — where we are

The app is **fully built and working locally.** Every feature from the original
spec is implemented and the production build compiles cleanly (TypeScript strict
mode passes). We have NOT deployed yet — by choice. The plan is to **dial in the
functionality first, then deploy.**

## To resume working

```bash
# from C:\Users\brand\Desktop\ToDo_Productivity
npm run dev
```

Open **http://localhost:5173**, sign in with the magic link, and you're back.
(`node_modules` is already installed. If it's somehow missing, run `npm install`
first.)

> Note: the dev server was running in a background terminal. Closing the
> terminal stops it — that's fine, just re-run `npm run dev` to pick back up.

## Setup already done (don't redo)

- [x] Supabase project created; credentials are in `.env.local`.
- [x] SQL migration (`supabase/migrations/001_init.sql`) has been run in the
      Supabase SQL Editor — `tasks` + `subtasks` tables, RLS, and realtime exist.
- [x] `http://localhost:5173` added to Supabase → Authentication → URL
      Configuration → Redirect URLs.
- [x] `npm install` done.
- [x] Verified the app loads, login works, and tasks work end-to-end.

## What's built (feature checklist — all done)

- [x] Magic-link auth, session persists across reloads, centered login screen
- [x] Realtime sync via Supabase subscription
- [x] Add task (text + category + priority + optional due date; inserts on top)
- [x] Task card: done toggle (strike + 50% fade), inline-edit text, category
      badge, priority dot, due-date chip (red overdue / amber today),
      expand/collapse, drag handle
- [x] Subtasks (add / check / delete inline; `2/4` count on collapsed card)
- [x] Search + filter pills (All / Active / Done / High / by category; one at a
      time; search stacks on filter)
- [x] Drag-to-reorder via @dnd-kit; positions persist to Supabase
- [x] Dark / light mode toggle, persisted to localStorage, no flash on load
- [x] Due-date reminders (on load + every 60s; Notification API or in-app banner)
- [x] Optimistic UI, loading skeletons, empty-state SVG, smooth transitions

## NOT done yet (next steps, roughly in order)

1. **Dial in functionality (current focus).** Use the app with real data and
   report rough edges / bugs to fix. Specific things worth stress-testing:
   - Drag-to-reorder *while a filter is active*, then switch back to All
   - Realtime across two browser tabs
   - Optimistic feel (toggle done / edit text — instant?)
   - Due-date reminder wording/behavior
2. **Make it a git repo** — this folder is NOT under version control yet.
   (`git init`, first commit) — do before deploying.
3. **Deploy to Vercel** — `vercel` then `vercel --prod`; add the two
   `VITE_SUPABASE_*` env vars in the Vercel dashboard; add the prod URL to
   Supabase Redirect URLs. (See README.md section 4.)
4. **Custom SMTP** (optional) — Supabase's built-in mailer is slow and
   rate-limited; set up SMTP under Auth → Email for instant magic links.

## Key files / map

```
.env.local                      <- real Supabase URL + anon key (gitignored)
.env.example                    <- template
supabase/migrations/001_init.sql<- DB schema + RLS (already run)
src/
  App.tsx                       <- auth gate, filtering, dnd wiring, layout
  hooks/
    useAuth.ts    useTasks.ts   <- useTasks = data layer (realtime + optimistic CRUD)
    useTheme.ts   useReminders.ts
  components/
    TaskCard.tsx  SubtaskList.tsx  AddTaskForm.tsx
    FilterBar.tsx SearchBar.tsx    DueDateReminder.tsx
    ThemeToggle.tsx  LoginScreen.tsx
  lib/supabase.ts   types/index.ts
README.md                       <- full setup + deploy instructions
```

## Useful commands

```bash
npm run dev      # start local dev server (http://localhost:5173)
npm run build    # type-check + production build (sanity check)
npm run preview  # serve the production build locally
```

## Gotchas / reminders

- The anon key in `.env.local` is the public `sb_publishable_...` key — safe in
  the browser (RLS guards data). Never put a `service_role` key in a `VITE_` var.
- Magic-link emails can take a minute and may land in spam; the free mailer is
  rate-limited to a handful per hour.
- If magic links error on click, re-check the Supabase Redirect URL is exactly
  `http://localhost:5173` (http, no trailing slash).
```
