-- ============================================================
-- Cho Lab Paper Assistant — Supabase Schema
-- Safe to re-run on both fresh and existing databases.
-- Run the entire file in Supabase SQL Editor.
-- ============================================================

-- pgvector must be in the extensions schema on Supabase
create extension if not exists vector with schema extensions;

-- ── Table: papers ─────────────────────────────────────────────────────────────
-- One row per paper. paper_key is the deduplication handle.

create table if not exists papers (
  id          uuid        primary key default gen_random_uuid(),
  paper_key   text        unique not null,
  title       text        not null,
  authors     text,
  year        int,
  journal     text,
  abstract    text,
  doi         text,
  keywords    text,
  source_url  text,
  pdf_url     text,
  best_link   text,
  local_path  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Patch columns that may be missing on tables created by earlier schema versions.
-- ADD COLUMN IF NOT EXISTS is idempotent — safe to run multiple times.
alter table papers add column if not exists abstract    text;
alter table papers add column if not exists doi        text;
alter table papers add column if not exists keywords   text;
alter table papers add column if not exists source_url text;
alter table papers add column if not exists pdf_url    text;
alter table papers add column if not exists best_link  text;
alter table papers add column if not exists local_path text;
alter table papers add column if not exists updated_at timestamptz default now();

-- ── Table: paper_chunks ───────────────────────────────────────────────────────
-- Embeddings are 768-dim from BAAI/bge-base-en-v1.5 (local SentenceTransformers).

create table if not exists paper_chunks (
  id           uuid        primary key default gen_random_uuid(),
  paper_id     uuid        references papers(id) on delete cascade,
  paper_key    text        not null,
  title        text        not null,
  authors      text,
  year         int,
  journal      text,
  doi          text,
  page         int,
  chunk_index  int,
  chunk_text   text        not null,
  source_url   text,
  pdf_url      text,
  best_link    text,
  token_count  int,
  char_count   int,
  metadata     jsonb,
  embedding    vector(768),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Patch columns for existing tables
alter table paper_chunks add column if not exists doi         text;
alter table paper_chunks add column if not exists best_link   text;
alter table paper_chunks add column if not exists token_count int;
alter table paper_chunks add column if not exists char_count  int;
alter table paper_chunks add column if not exists metadata    jsonb;
alter table paper_chunks add column if not exists updated_at  timestamptz default now();

-- Index on paper_key for fast DELETE during re-ingestion
create index if not exists paper_chunks_paper_key_idx
  on paper_chunks(paper_key);

-- ── updated_at trigger ────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists papers_updated_at on papers;
create trigger papers_updated_at
  before update on papers
  for each row execute procedure set_updated_at();

drop trigger if exists paper_chunks_updated_at on paper_chunks;
create trigger paper_chunks_updated_at
  before update on paper_chunks
  for each row execute procedure set_updated_at();

-- ── Vector similarity search function ────────────────────────────────────────
-- Called via supabase.rpc('match_paper_chunks', { query_embedding, match_count, match_threshold })
-- Column list must stay in sync with MatchedChunk in web/lib/types.ts

create or replace function match_paper_chunks(
  query_embedding  vector(768),
  match_count      int   default 6,
  match_threshold  float default 0.35
)
returns table (
  id           uuid,
  paper_id     uuid,
  paper_key    text,
  title        text,
  authors      text,
  year         int,
  journal      text,
  doi          text,
  page         int,
  chunk_index  int,
  chunk_text   text,
  source_url   text,
  pdf_url      text,
  best_link    text,
  similarity   float
)
language sql stable
as $$
  select
    pc.id,
    pc.paper_id,
    pc.paper_key,
    pc.title,
    pc.authors,
    pc.year,
    pc.journal,
    pc.doi,
    pc.page,
    pc.chunk_index,
    pc.chunk_text,
    pc.source_url,
    pc.pdf_url,
    pc.best_link,
    1 - (pc.embedding <=> query_embedding) as similarity
  from paper_chunks pc
  where
    pc.embedding is not null
    and 1 - (pc.embedding <=> query_embedding) > match_threshold
  order by pc.embedding <=> query_embedding asc
  limit match_count;
$$;

-- ── Optional HNSW vector index ────────────────────────────────────────────────
-- Uncomment AFTER ingesting your papers for faster cosine search.
-- Not needed for a small dataset (< a few thousand chunks).
--
-- create index on paper_chunks
--   using hnsw (embedding vector_cosine_ops)
--   with (m = 16, ef_construction = 64);

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
