# Project Rules — Read at Start of Every Session

## Auto Migration
Whenever you create a new Supabase migration file (anything in `supabase/migrations/`), run the following immediately after creating it:

    npx supabase db push

If it returns a duplicate key error, run:

    npx supabase migration list

to identify which migrations are already applied, then skip those and only apply pending ones. Never re-run an already-applied migration.

> **History note (resolved 2026-07):** a duplicate version `005`
> (`005_resync_default_muscles.sql` + a second `005_workout_sets_rest.sql`) had
> silently broken `db push` for a long time, leaving `user_preferences`, `notes`,
> `note_pages` and `show_rpe` unapplied on remote. Fixed by renaming the second
> file to `018_workout_sets_rest.sql`, repairing the tracking table, and pushing
> `012–018`. Local and remote history are now in sync through `018` and `db push`
> works cleanly. Every migration is written idempotently (`if not exists` /
> `if exists` guards), so re-running is safe.

## Auto Deploy
After completing ANY change in a session — whether it's a bug fix, new feature, migration, or config change — always run the following before ending the session:

1. `npm run build` (confirm it passes with no errors)
2. `git add .`
3. `git commit -m "[brief description of what changed this session]"`
4. `git push`

Never end a session without pushing if changes were made. If the build fails, fix the errors before pushing — never push broken code.

## Migration + Deploy Order
Always do things in this order when both apply:

1. Write code changes
2. Create migration file if schema changed
3. Run `npx supabase db push`
4. Run `npm run build`
5. `git add . && git commit && git push`

## General Rules
- Never modify existing migration files that have already been applied — create new ones instead.
- Always confirm the git push succeeded before reporting the session as complete.
- If anything fails (migration, build, or push), report the error clearly and fix it before finishing.
