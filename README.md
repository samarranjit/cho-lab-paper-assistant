# Cho Lab Paper Assistant

A simple, free-first RAG web app for asking questions about Cho Lab research papers.

---

## Repository layout

```
cho-lab-paper-assistant/
├── web/           ← Next.js app — deployed to Vercel
├── local-tools/   ← Python ingestion — runs on your lab computer only
├── supabase/      ← Database schema — run once in Supabase SQL Editor
├── .gitignore
└── README.md      ← this file
```

---

## Architecture

```
[One-time — lab computer only]
PDF files
  → pdfplumber page extraction
  → overlap chunking
  → BAAI/bge-base-en-v1.5 (local SentenceTransformers, normalize_embeddings=True)
  → Supabase paper_chunks (embedding vector(768))

[Runtime — Vercel]
User question
  → Cloudflare @cf/baai/bge-base-en-v1.5  (query embedding, 1 call per question)
  → Supabase pgvector cosine search
  → Cloudflare @cf/meta/llama-3.1-8b-instruct-fp8-fast  (answer generation)
  → Answer + source cards with citations
```

### Key design decision

**The lab computer does NOT need to run continuously.**

With `EMBEDDING_PROVIDER=cloudflare` (the default), the lab computer is only needed
when ingesting new or updated papers. After ingestion, all runtime operations
(query embedding, vector search, answer generation) happen on Cloudflare and Supabase.

The lab computer only needs to stay online if you choose `EMBEDDING_PROVIDER=local_http`
(see `local-tools/README.md` for details on that option).

---

## Accounts required (all free tiers work)

| Service | Purpose | URL |
|---|---|---|
| Supabase | Postgres + pgvector vector database | https://supabase.com |
| Cloudflare | Workers AI for query embedding + LLM | https://dash.cloudflare.com |
| Vercel | Host the Next.js web app | https://vercel.com |

---

## Quick-start order

1. **Supabase** — create project, run `supabase/schema.sql` in SQL Editor.
2. **Cloudflare** — get Account ID and create API Token (Workers AI Edit).
3. **Local tools** — set up Python venv, add PDFs, run ingestion (see `local-tools/README.md`).
4. **Web app** — install deps, create `.env.local`, test locally (see `web/README.md`).
5. **Vercel** — deploy `web/` with root directory set to `web` (see `web/README.md`).

---

## Supabase setup

1. Create a new project at https://supabase.com.
2. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL` (e.g. `https://abcdef.supabase.co`)
   - **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY`
3. Go to **SQL Editor** and paste + run the entire contents of `supabase/schema.sql`.
4. The schema is safe to re-run — it uses `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` guards.

> The Supabase URL should be `https://PROJECT_ID.supabase.co` with nothing after `.co`.
> Do NOT use the database password. Use the `service_role` JWT key.

---

## Security

- `SUPABASE_SERVICE_ROLE_KEY` and `CLOUDFLARE_API_TOKEN` are used only in server-side code.
- They are never passed to the browser.
- `.env.local` files are gitignored.
- Never commit real keys. If a key is accidentally committed, rotate it immediately.
