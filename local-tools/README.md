# local-tools/ — Cho Lab Paper Ingestion

This folder runs only on your lab computer.
It is never deployed to Vercel.

---

## What it does

1. Reads PDFs from `local-tools/papers/`.
2. Extracts text page-by-page using `pdfplumber`.
3. Splits text into overlapping chunks (~3000 chars, 400 char overlap).
4. Embeds each chunk locally using `BAAI/bge-base-en-v1.5` via `sentence-transformers`.
5. Stores paper metadata + chunk embeddings in Supabase.

Zero Cloudflare calls. Re-ingestion is safe and idempotent.

---

## When does the lab computer need to run?

| Task | Lab computer needed? |
|---|---|
| Adding or updating papers | **Yes** — run ingestion |
| Web app answering questions | **No** (with `EMBEDDING_PROVIDER=cloudflare`) |
| Web app answering questions | **Yes** (only if `EMBEDDING_PROVIDER=local_http`) |

The default and recommended mode is `EMBEDDING_PROVIDER=cloudflare`.
In that mode, the lab computer only needs to run when ingesting new papers.

---

## Setup

### 1. Create a Python virtual environment

```bash
cd local-tools
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

The first `pip install` downloads `BAAI/bge-base-en-v1.5` (~400 MB) and caches it
in `~/.cache/huggingface/`. Subsequent runs load it from cache.

### 2. Create .env.local

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Adding papers

1. Place your PDF files in `local-tools/papers/`.
2. Open `local-tools/metadata/papers.json`.
3. Add or update an entry with the matching `local_path` (relative to `local-tools/`).

Example entry:

```json
{
  "paper_key": "author_year_slug",
  "title": "Full Paper Title",
  "authors": "Last, F., & Last, F.",
  "year": 2024,
  "journal": "Journal Name",
  "abstract": "Brief description.",
  "doi": "10.XXXX/XXXXXXX",
  "keywords": "keyword1, keyword2",
  "source_url": "https://doi.org/10.XXXX/XXXXXXX",
  "pdf_url": "",
  "best_link": "https://doi.org/10.XXXX/XXXXXXX",
  "local_path": "papers/filename.pdf"
}
```

See `metadata/papers.example.json` for a template.

---

## Running ingestion

```bash
cd local-tools
source .venv/bin/activate
python scripts/ingest_local.py
```

What happens:
- Loads each paper from `metadata/papers.json`
- Skips any paper whose PDF is not found
- Extracts text, chunks, embeds (locally), upserts to Supabase
- Deletes old chunks before inserting new ones (safe to re-run)
- Logs progress to terminal

---

## Optional: local embedding server

Only needed if you want `EMBEDDING_PROVIDER=local_http` in the web app.
Not needed for the default `EMBEDDING_PROVIDER=cloudflare`.

```bash
cd local-tools
source .venv/bin/activate
uvicorn scripts.embedding_server:app --host 0.0.0.0 --port 8001
```

The server will be at http://localhost:8001.

To make it reachable from Vercel, expose it with a tunnel:

```bash
# Option A: Cloudflare Tunnel (free, no account needed for quick tunnels)
cloudflared tunnel --url http://localhost:8001

# Option B: ngrok
ngrok http 8001
```

Then set in `web/.env.local` (and Vercel env vars):

```
EMBEDDING_PROVIDER=local_http
LOCAL_EMBEDDING_API_URL=https://your-tunnel-url.trycloudflare.com/embed
LOCAL_EMBEDDING_API_KEY=optional_secret_key
```

> If you use local_http, the lab computer must stay online as long as the web app is serving users.

---

## Troubleshooting

**"PDF not found, skipping"**
→ The `local_path` in `papers.json` doesn't match the actual filename. Check spelling and case.

**"SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing"**
→ Check `local-tools/.env.local`. Make sure the URL is `https://PROJECT_ID.supabase.co` with no trailing path.

**"No usable chunks — PDF may be image-only"**
→ The PDF is a scanned image. `pdfplumber` can only extract digital text. You need OCR preprocessing first (e.g., `ocrmypdf`).

**Slow first run**
→ The first run downloads the ~400 MB model. Subsequent runs load from cache.
