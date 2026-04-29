-- =============================================================================
-- ADDITIVE MIGRATION: add journal_ref and comment to papers
--
-- arXiv papers sometimes include:
--   - journal_ref: where the paper was actually published (e.g. "NeurIPS 2024")
--   - comment:     author comments (often "to appear at ICML 2025", page counts)
--
-- These two strings are great for surfacing venue info on cards. Run this
-- file once in Supabase SQL Editor. It's idempotent — running it twice is
-- harmless.
--
-- After running, redeploy / wait for Vercel to redeploy so the new ingest
-- code populates these columns on tomorrow's cron (or on a manual trigger).
-- Existing rows will keep null values for these columns until they're
-- re-ingested.
-- =============================================================================

alter table papers add column if not exists journal_ref text;
alter table papers add column if not exists comment text;

-- Rebuild the recommender RPCs to return the new columns. Postgres won't let
-- CREATE OR REPLACE change the return shape, so we drop first.

drop function if exists recommend_by_similarity(text, vector, text[], int);
drop function if exists recommend_random(text, text[], int);

create or replace function recommend_by_similarity(
  p_user_id text, user_vec vector(384), user_cats text[], k int default 30
) returns table (
  id text, title text, authors text[], abstract text,
  categories text[], primary_category text,
  pdf_url text, published_at timestamptz,
  journal_ref text, comment text,
  similarity real
) as $$
  select
    p.id, p.title, p.authors, p.abstract, p.categories, p.primary_category,
    p.pdf_url, p.published_at, p.journal_ref, p.comment,
    1 - (p.embedding <=> user_vec) as similarity
  from papers p
  where p.embedding is not null
    and p.categories && user_cats
    and p.id not in (
      select paper_id from interactions
      where user_id = p_user_id
        and event_type in ('tap','save','pdf_open')
    )
  order by p.embedding <=> user_vec
  limit k;
$$ language sql stable;

create or replace function recommend_random(
  p_user_id text, user_cats text[], k int default 5
) returns table (
  id text, title text, authors text[], abstract text,
  categories text[], primary_category text,
  pdf_url text, published_at timestamptz,
  journal_ref text, comment text
) as $$
  select
    p.id, p.title, p.authors, p.abstract, p.categories, p.primary_category,
    p.pdf_url, p.published_at, p.journal_ref, p.comment
  from papers p
  where p.categories && user_cats
    and p.id not in (
      select paper_id from interactions
      where user_id = p_user_id
        and event_type in ('impression','tap','save','pdf_open')
    )
  order by random()
  limit k;
$$ language sql volatile;
