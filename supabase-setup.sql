-- =============================================================================
-- paper-feed: full Supabase schema setup
-- Run this entire file in Supabase SQL Editor (one shot is fine).
-- Vector dimension is 384 to match Hugging Face all-MiniLM-L6-v2.
-- If you switch to OpenAI text-embedding-3-small later, change 384 → 1536.
-- =============================================================================

-- 1. enable pgvector for similarity search
create extension if not exists vector;

-- =============================================================================
-- 2. papers — every paper ingested from arXiv
-- =============================================================================
create table if not exists papers (
  id text primary key,                       -- arxiv id, e.g. "2401.12345"
  title text not null,
  authors text[] default '{}',
  abstract text,
  categories text[] default '{}',            -- e.g. ['cs.LG', 'stat.ML']
  primary_category text,                     -- the first/main category
  pdf_url text,
  published_at timestamptz,
  embedding vector(384),                     -- HF MiniLM dimension
  created_at timestamptz default now()
);

create index if not exists papers_published_idx on papers (published_at desc);
create index if not exists papers_categories_idx on papers using gin (categories);
-- ivfflat needs data before it's useful; create after some rows exist, or it
-- will warn. It still works for now.
create index if not exists papers_embedding_idx
  on papers using ivfflat (embedding vector_cosine_ops) with (lists = 50);

-- =============================================================================
-- 3. interactions — every signal we collect (impression, dwell, tap, save, etc.)
-- =============================================================================
create table if not exists interactions (
  id bigserial primary key,
  paper_id text references papers(id) on delete cascade,
  event_type text not null check (event_type in (
    'impression',     -- card entered viewport
    'dwell',          -- card visible > 2s in grid
    'tap',            -- opened detail view
    'long_view',      -- stayed on detail > 10s
    'save',           -- explicit bookmark
    'pdf_open'        -- clicked through to PDF
  )),
  duration_ms int,
  occurred_at timestamptz default now()
);

create index if not exists interactions_paper_event_idx
  on interactions (paper_id, event_type);
create index if not exists interactions_occurred_idx
  on interactions (occurred_at desc);

-- =============================================================================
-- 4. user_preferences — single-row table for the solo user
-- =============================================================================
create table if not exists user_preferences (
  id int primary key default 1 check (id = 1),  -- enforce single row
  categories text[] default '{}',                -- arXiv cats user follows
  profile_vector vector(384),                    -- evolving taste vector
  daily_count int default 30,                    -- target feed size
  exploration_rate real default 0.15,            -- % random papers
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- 5. category_stats — Thompson Sampling counters per arXiv category
-- =============================================================================
create table if not exists category_stats (
  category text primary key,
  alpha real default 1.0 not null,   -- positive evidence
  beta real default 1.0 not null,    -- negative evidence
  updated_at timestamptz default now()
);

-- =============================================================================
-- 6. helper RPC: upsert a category_stats row, incrementing alpha or beta
-- =============================================================================
create or replace function bump_category_stats(
  cats text[],
  alpha_delta real,
  beta_delta real
) returns void as $$
begin
  insert into category_stats (category, alpha, beta)
  select unnest(cats), 1.0 + greatest(alpha_delta, 0), 1.0 + greatest(beta_delta, 0)
  on conflict (category) do update set
    alpha = category_stats.alpha + greatest(alpha_delta, 0),
    beta  = category_stats.beta  + greatest(beta_delta, 0),
    updated_at = now();
end;
$$ language plpgsql;

-- =============================================================================
-- 7. helper RPC: cosine-similarity search restricted to chosen categories
--    and excluding already-tapped papers
-- =============================================================================
create or replace function recommend_by_similarity(
  user_vec vector(384),
  user_cats text[],
  k int default 30
) returns table (
  id text,
  title text,
  authors text[],
  abstract text,
  categories text[],
  primary_category text,
  pdf_url text,
  published_at timestamptz,
  similarity real
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
      where event_type in ('tap','save','pdf_open')
    )
  order by p.embedding <=> user_vec
  limit k;
$$ language sql stable;

-- =============================================================================
-- 8. helper RPC: random sample from chosen categories, excluding seen papers
-- =============================================================================
create or replace function recommend_random(
  user_cats text[],
  k int default 5
) returns table (
  id text,
  title text,
  authors text[],
  abstract text,
  categories text[],
  primary_category text,
  pdf_url text,
  published_at timestamptz
) as $$
  select
    p.id, p.title, p.authors, p.abstract, p.categories, p.primary_category,
    p.pdf_url, p.published_at
  from papers p
  where p.categories && user_cats
    and p.id not in (
      select paper_id from interactions
      where event_type in ('impression','tap','save','pdf_open')
    )
  order by random()
  limit k;
$$ language sql volatile;

-- =============================================================================
-- 9. seed the user_preferences row so onboarding can update it
-- =============================================================================
insert into user_preferences (id) values (1) on conflict (id) do nothing;

-- =============================================================================
-- done. Verify with:
--   select count(*) from papers;
--   select * from user_preferences;
-- =============================================================================
