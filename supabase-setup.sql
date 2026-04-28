-- =============================================================================
-- paper-feed: Supabase schema (multi-user version)
-- Run the entire file once in Supabase's SQL Editor.
-- Vector dimension is 384 to match Hugging Face all-MiniLM-L6-v2.
--
-- ⚠️  If you already ran an older version of this file, see
-- `supabase-migrate-multiuser.sql` instead — it drops the old single-user
-- tables and recreates them in the multi-user shape.
-- =============================================================================

create extension if not exists vector;

-- =============================================================================
-- 1. users — anyone who has claimed a handle. id = handle they chose.
-- =============================================================================
create table if not exists users (
  id text primary key,                       -- user-chosen handle, 3-30 chars
  key_hash text not null,                    -- sha256(key + ':' + id), hex
  created_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- =============================================================================
-- 2. papers — global. one paper, one row, regardless of user.
-- =============================================================================
create table if not exists papers (
  id text primary key,                       -- arxiv id, e.g. "2401.12345"
  title text not null,
  authors text[] default '{}',
  abstract text,
  categories text[] default '{}',
  primary_category text,
  pdf_url text,
  published_at timestamptz,
  embedding vector(384),
  created_at timestamptz default now()
);

create index if not exists papers_published_idx on papers (published_at desc);
create index if not exists papers_categories_idx on papers using gin (categories);
create index if not exists papers_embedding_idx
  on papers using ivfflat (embedding vector_cosine_ops) with (lists = 50);

-- =============================================================================
-- 3. user_preferences — one row per user
-- =============================================================================
create table if not exists user_preferences (
  user_id text primary key references users(id) on delete cascade,
  categories text[] default '{}',
  profile_vector vector(384),
  daily_count int default 30,
  exploration_rate real default 0.15,
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- 4. interactions — every signal, scoped to a user
-- =============================================================================
create table if not exists interactions (
  id bigserial primary key,
  user_id text not null references users(id) on delete cascade,
  paper_id text references papers(id) on delete cascade,
  event_type text not null check (event_type in (
    'impression','dwell','tap','long_view','save','pdf_open'
  )),
  duration_ms int,
  occurred_at timestamptz default now()
);

create index if not exists interactions_user_paper_idx
  on interactions (user_id, paper_id);
create index if not exists interactions_user_event_idx
  on interactions (user_id, event_type);
create index if not exists interactions_occurred_idx
  on interactions (occurred_at desc);

-- =============================================================================
-- 5. category_stats — Thompson Sampling counters PER USER
-- =============================================================================
create table if not exists category_stats (
  user_id text not null references users(id) on delete cascade,
  category text not null,
  alpha real default 1.0 not null,
  beta real default 1.0 not null,
  updated_at timestamptz default now(),
  primary key (user_id, category)
);

-- =============================================================================
-- 6. RPC: bump category stats for a user
-- =============================================================================
create or replace function bump_category_stats(
  p_user_id text,
  cats text[],
  alpha_delta real,
  beta_delta real
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

-- =============================================================================
-- 7. RPC: cosine-similar papers for a user, excluding ones they've tapped
-- =============================================================================
create or replace function recommend_by_similarity(
  p_user_id text,
  user_vec vector(384),
  user_cats text[],
  k int default 30
) returns table (
  id text, title text, authors text[], abstract text,
  categories text[], primary_category text,
  pdf_url text, published_at timestamptz, similarity real
) as $$
  select
    p.id, p.title, p.authors, p.abstract, p.categories, p.primary_category,
    p.pdf_url, p.published_at,
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

-- =============================================================================
-- 8. RPC: random sample for a user, excluding seen papers
-- =============================================================================
create or replace function recommend_random(
  p_user_id text,
  user_cats text[],
  k int default 5
) returns table (
  id text, title text, authors text[], abstract text,
  categories text[], primary_category text,
  pdf_url text, published_at timestamptz
) as $$
  select
    p.id, p.title, p.authors, p.abstract, p.categories, p.primary_category,
    p.pdf_url, p.published_at
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

-- =============================================================================
-- 9. RPC: union of all users' followed categories — used by the daily cron
-- =============================================================================
create or replace function all_followed_categories()
returns table (category text) as $$
  select distinct unnest(categories) from user_preferences
  where coalesce(array_length(categories, 1), 0) > 0;
$$ language sql stable;

-- =============================================================================
-- done. Verify with:
--   select count(*) from users;
--   select count(*) from papers;
-- =============================================================================
