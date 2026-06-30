# S Hub — a personal productivity app

A mobile-first personal productivity hub (to-do, voice, workout, focus) with
magic-link auth, real-time sync, drag-to-reorder, subtasks, search/filter,
due-date reminders, and dark mode.

**Stack:** React + Vite (TypeScript) · Supabase (auth + Postgres + realtime) ·
Tailwind CSS · `@dnd-kit` · deploys to Vercel.

---

## 1. Create a Supabase project & run the migrations

1. Go to <https://supabase.com> → **New project**. Pick a name, a database
   password, and a region. Wait for it to finish provisioning.
2. Open **SQL Editor → New query** and run **all three** migrations in order,
   pasting and **Run**ning each one before moving to the next. The app expects
   the full schema — skipping a migration will cause inserts to fail silently
   (e.g. tasks appear but vanish on reload):
   1. [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) —
      creates the `tasks` and `subtasks` tables, enables Row Level Security with
      per-user policies, and registers both tables for realtime.
   2. [`supabase/migrations/002_categories.sql`](supabase/migrations/002_categories.sql)
      — adds the user-defined `categories` table (with RLS + realtime) and drops
      the old fixed-value CHECK on `tasks.category`.
   3. [`supabase/migrations/003_completion_date.sql`](supabase/migrations/003_completion_date.sql)
      — adds the `tasks.scheduled_date` column (the "Do" / plan-to-work day).
3. (Magic-link email) Go to **Authentication → Providers → Email** and make sure
   **Email** is enabled. For magic links you can leave "Confirm email" on; no
   password is required.
4. Add your app URL to **Authentication → URL Configuration → Redirect URLs**
   (e.g. `http://localhost:5173` for local dev and your Vercel URL for prod).
   The magic link redirects back to `window.location.origin`.

> Using the Supabase CLI instead? From the project root run
> `supabase link --project-ref <your-ref>` then `supabase db push`.

## 2. Set up `.env.local`

Copy the example file and fill in your project's values:

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
```

Find both under **Project Settings → API**:
- `VITE_SUPABASE_URL` → "Project URL"
- `VITE_SUPABASE_ANON_KEY` → the `anon` / publishable key

Both values are safe to expose in the browser — RLS enforces access. **Never**
put your `service_role` key in a `VITE_`-prefixed variable.

## 3. Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default <http://localhost:5173>). Enter your email,
click the magic link in your inbox, and you're in.

## 4. Deploy to Vercel

```bash
npm i -g vercel   # once
vercel            # preview deploy
vercel --prod     # production deploy
```

During the first run Vercel detects Vite automatically (build command
`npm run build`, output dir `dist`). Add the two environment variables in the
Vercel dashboard (**Project → Settings → Environment Variables**) or via CLI:

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

Then redeploy with `vercel --prod`. Finally, add your production URL to the
Supabase **Redirect URLs** list (step 1.4) so magic links work in production.

---

## Features

- **Magic-link auth** — email only, session persists across reloads.
- **Realtime sync** — changes stream in via Supabase subscriptions.
- **Add tasks** with category, priority, and optional due date; new tasks land
  on top.
- **Task cards** — toggle done (strike + fade), inline-edit text, category
  badge, priority dot, due-date chip (red overdue / amber today), expand for
  subtasks + notes, drag handle to reorder.
- **Subtasks** — add/check/delete inline; collapsed cards show a `2/4` count.
- **Search + filters** — client-side text search stacked on top of
  All / Active / Done / High priority / per-category pills.
- **Drag to reorder** with `@dnd-kit`; positions persist to Supabase.
- **Dark / light mode** — toggle persists to `localStorage`.
- **Due-date reminders** — checked on load and every 60s; fires a browser
  notification when permitted, otherwise an in-app banner.
- **Optimistic UI**, loading skeletons, and an empty-state illustration.

## Project structure

```
src/
  components/   TaskCard, SubtaskList, AddTaskForm, FilterBar, SearchBar,
                DueDateReminder, ThemeToggle, LoginScreen
  hooks/        useTasks, useAuth, useTheme, useReminders
  lib/          supabase.ts
  types/        index.ts
  App.tsx, main.tsx
supabase/migrations/001_init.sql
```
