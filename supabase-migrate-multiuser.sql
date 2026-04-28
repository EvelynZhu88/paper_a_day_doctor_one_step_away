-- =============================================================================
-- ONE-TIME MIGRATION: single-user schema → multi-user schema
-- Run this in Supabase SQL Editor IF you ran the original supabase-setup.sql
-- (single-user version) before. It drops the old tables and recreates them.
--
-- ⚠️  This wipes existing data: user_preferences row, all interactions,
--     and all category_stats. Papers are also dropped because their cron
--     filtering logic changes.
--
-- If you're a fresh installer, run `supabase-setup.sql` instead — not this.
-- =============================================================================

drop function if exists bump_category_stats(text[], real, real);
drop function if exists recommend_by_similarity(vector, text[], int);
drop function if exists recommend_random(text[], int);

drop table if exists interactions cascade;
drop table if exists category_stats cascade;
drop table if exists user_preferences cascade;
drop table if exists papers cascade;
drop table if exists users cascade;

-- now run the canonical setup
\i supabase-setup.sql

-- if your SQL editor doesn't support \i, just paste the contents of
-- supabase-setup.sql below this line and run.
