-- =============================================================================
-- ONE-TIME MIGRATION: single-user schema → multi-user schema
-- Run this in Supabase SQL Editor IF you ran the original supabase-setup.sql
-- (single-user version) before. It drops the old tables and recreates them.
--
-- ⚠️  This wipes existing data: user_preferences, all interactions, and all
--     category_stats. Papers are also dropped because their cron filtering
--     logic changes.
--
-- If you're a fresh installer, run `supabase-setup.sql` instead — not this.
-- =============================================================================

-- 1. drop the old single-user signatures (the new file uses different ones)
drop function if exists bump_category_stats(text[], real, real);
drop function if exists recommend_by_similarity(vector, text[], int);
drop function if exists recommend_random(text[], int);

-- 2. drop tables (cascade clears any leftover indexes/triggers)
drop table if exists interactions cascade;
drop table if exists category_stats cascade;
drop table if exists user_preferences cascade;
drop table if exists papers cascade;
drop table if exists users cascade;

-- =============================================================================
-- 3. CANONICAL MULTI-USER SCHEMA — same content as supabase-setup.sql
--    (inlined here so you can run this single file in the Supabase SQL editor
--    without needing psql's \i directive)
-- =============================================================================

create extension if not exists vector;

create table users (
  id text primary key,
  key_hash text not null,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

create table papers (
  id text primary key,
  title text not null,
  authors text[] default '{}',
  abstract text,
  categories text[] default '{}',
  primary_category text,
  pdf_url text,
  published_at timestamptz,
  journal_ref text,
  comment text,
  embedding vector(384),
  created_at timestamptz default now()
);

create index papers_published_idx on papers (published_at desc);
create index papers_categories_idx on papers using gin (categories);
create index papers_embedding_idx on papers using ivfflat (embedding vector_cosine_ops) with (lists = 50);

create table user_preferences (
  user_id text primary key references users(id) on delete cascade,
  categories text[] default '{}',
  profile_vector vector(384),
  daily_count int default 30,
  exploration_rate real default 0.15,
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table interactions (
  id bigserial primary key,
  user_id text not null references users(id) on delete cascade,
  paper_id text references papers(id) on delete cascade,
  event_type text not null check (event_type in (
    'impression','dwell','tap','long_view','save','pdf_open'
  )),
  duration_ms int,
  occurred_at timestamptz default now()
);

create index interactions_user_paper_idx on interactions (user_id, paper_id);
create index interactions_user_event_idx on interactions (user_id, event_type);
create index interactions_occurred_idx on interactions (occurred_at desc);

create table category_stats (
  user_id text not null references users(id) on delete cascade,
  category text not null,
  alpha real default 1.0 not null,
  beta real default 1.0 not null,
  updated_at timestamptz default now(),
  primary key (user_id, category)
);

create or replace function bump_category_stats(
  p_user_id text, cats text[], alpha_delta real, beta_delta real
) returns void as $$
begin
  insert into category_stats (user_id, category, alpha, beta)
  select p_user_id, unnest(cats), 1.0 + greatest(alpha_delta, 0), 1.0 + greatest(beta_delta, 0)
  on conflict (user_id, category) do update set
    alpha = category_stats.alpha + greatest(alpha_delta, 0),
    beta  = category_stats.beta  + greatest(beta_delta, 0),
    updated_at = now();
end;
$$ language plpgsql;

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

create or replace function all_followed_categories()
returns table (category text) as $$
  select distinct unnest(categories) from user_preferences
  where coalesce(array_length(categories, 1), 0) > 0;
$$ language sql stable;

-- done. verify with:
--   select count(*) from users;
--   select count(*) from papers;
