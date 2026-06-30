-- ============================================================================
-- 006_template_sets.sql — per-set definitions for template exercises
-- Run in the Supabase SQL Editor after 005. Safe to run once.
--
-- Stores an ordered list of planned sets per template exercise as JSONB, e.g.
--   [{"reps":5,"weight":135,"type":"warmup"}, {"reps":5,"weight":225,"type":"normal"}]
-- The legacy default_sets/default_reps/default_weight columns remain as a
-- fallback for templates created before this migration.
-- ============================================================================

alter table public.template_exercises
  add column if not exists sets jsonb not null default '[]'::jsonb;
