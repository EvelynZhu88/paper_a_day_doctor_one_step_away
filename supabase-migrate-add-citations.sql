-- =============================================================================
-- ADDITIVE MIGRATION: add citation_count column + extend RPC return types.
--
-- Run this AFTER supabase-migrate-add-venue.sql (which added journal_ref +
-- comment). This migration is idempotent.
--
-- citation_count is populated only for papers ingested via Semantic Scholar
-- (the foundational-paper seeder). arXiv-only papers will have null/0.
-- =============================================================================

alter table papers add column if not exists citation_count int;
create index if not exists papers_citations_idx on papers (citation_count desc nulls last);

-- Postgres requires DROP before changing RPC return shape.
drop function if exists recommend_by_similarity(text, vector, text[], int);
drop function if exists recommend_random(text, text[], int);

create or replace function recommend_by_similarity(
  p_user_id text, user_vec vector(384), user_cats text[], k int default 30
) returns table (
  id text, title text, authors text[], abstract text,
  categories text[], primary_category text,
  pdf_url text, published_at timestamptz,
  journal_ref text, comment text,
  citation_count int,
  similarity real
) as $$
  select
    p.id, p.title, p.authors, p.abstract, p.categories, p.primary_category,
    p.pdf_url, p.published_at, p.journal_ref, p.comment, p.citation_count,
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
  journal_ref text, comment text,
  citation_count int
) as $$
  select
    p.id, p.title, p.authors, p.abstract, p.categories, p.primary_category,
    p.pdf_url, p.published_at, p.journal_ref, p.comment, p.citation_count
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
