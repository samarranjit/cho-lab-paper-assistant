# Cho Lab Paper Assistant

A lightweight retrieval-augmented generation (RAG) web application for asking questions about Cho Lab research papers. The assistant retrieves relevant excerpts from indexed papers, generates grounded answers, and provides source citations with paper links.

The system is designed to be minimal, cost-efficient, and deployment-friendly:

- **Local lab computer** handles one-time document processing and embedding generation.
- **Supabase + pgvector** stores paper metadata, chunks, and vector embeddings.
- **Vercel-hosted Next.js app** provides the public interface and API route.
- **Cloudflare Workers AI** is used only for runtime query embedding and final answer generation by default.

---

## Repository Structure

```txt
cho-lab-paper-assistant/
├── web/                # Next.js web app deployed to Vercel
├── local-tools/        # Local ingestion and optional embedding server
├── supabase/           # Database schema and vector search function
├── README.md
└── .gitignore
web/

The public-facing Next.js application. This is the only folder deployed to Vercel.

Responsibilities:

User question interface
/api/ask endpoint
Query embedding
Supabase vector search
RAG prompt construction
Cloudflare answer generation
Source card rendering
local-tools/

Local tooling for preparing the paper database. This runs on a lab computer or development machine.

Responsibilities:

PDF text extraction
Page-aware chunking
Local embedding generation using BAAI/bge-base-en-v1.5
Uploading paper metadata and chunks to Supabase
Optional local embedding API for advanced runtime use
supabase/

Contains the SQL schema for:

papers
paper_chunks
match_paper_chunks(...)
pgvector configuration
timestamp triggers
Architecture
One-Time Local Ingestion
PDFs
  → text extraction
  → page-aware chunking
  → local BGE embeddings
  → Supabase pgvector storage

Document embeddings are generated locally to avoid using hosted AI quota for bulk one-time processing.

Runtime Question Answering
User question
  → Cloudflare query embedding
  → Supabase vector search
  → retrieved paper excerpts
  → Cloudflare LLM answer
  → cited response + source cards

By default, the lab computer does not need to stay online after ingestion. The deployed app uses Cloudflare only for lightweight runtime operations.

Technology Stack
Layer	Tool
Frontend	Next.js, React, TypeScript, Tailwind CSS
Hosting	Vercel
Vector Database	Supabase Postgres + pgvector
Local Embeddings	SentenceTransformers + BAAI/bge-base-en-v1.5
Runtime Query Embeddings	Cloudflare Workers AI
Answer Generation	Cloudflare Workers AI
PDF Processing	pdfplumber
Optional Local API	FastAPI + Uvicorn
Environment Variables
Web App

Create web/.env.local for local development and add the same variables to Vercel.

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_LLM_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8-fast
CLOUDFLARE_EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5

EMBEDDING_PROVIDER=cloudflare
LOCAL_EMBEDDING_API_URL=
LOCAL_EMBEDDING_API_KEY=

MATCH_COUNT=6
MATCH_THRESHOLD=0.35
Local Tools

Create local-tools/.env.local.

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

LOCAL_EMBEDDING_MODEL=BAAI/bge-base-en-v1.5
LOCAL_EMBEDDING_API_KEY=

The Supabase service role key and Cloudflare API token must remain server-side only. Do not expose them in client components or commit them to Git.

Supabase Setup

Create a Supabase project and run the schema:

Supabase Dashboard → SQL Editor → run supabase/schema.sql

The schema enables pgvector, creates the required tables, patches missing columns safely, and defines the match_paper_chunks RPC function used by the web app.

Expected tables:

papers
paper_chunks

Expected RPC function:

match_paper_chunks(query_embedding, match_count, match_threshold)
Local Paper Ingestion

Paper ingestion is run from local-tools/.

cd local-tools
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python scripts/ingest_local.py

The ingestion script reads paper metadata from:

local-tools/metadata/papers.json

and PDFs from:

local-tools/papers/

Actual PDFs are intentionally ignored by Git.

Metadata Format

Each paper entry should follow this structure:

{
  "paper_key": "cho_2021_future_snowpack_snowmelt_runoff_potential_extremes",
  "title": "Future Changes in Snowpack, Snowmelt, and Runoff Potential Extremes Over North America",
  "authors": "Cho, E., McCrary, R. R., & Jacobs, J. M.",
  "year": 2021,
  "journal": "Geophysical Research Letters",
  "abstract": "",
  "doi": "10.1029/2021GL094985",
  "keywords": "snowpack, snowmelt, runoff potential, climate change",
  "source_url": "",
  "pdf_url": "",
  "best_link": "",
  "local_path": "papers/example.pdf"
}

The local_path is relative to local-tools/.

The ingestion process is idempotent: existing chunks for the same paper_key are removed before new chunks are inserted.

Running the Web App Locally
cd web
npm install
npm run dev

Open:

http://localhost:3000
Deploying to Vercel

Import the repository into Vercel and set:

Root Directory = web

Add the environment variables from web/.env.example.

The deployed app does not need access to the local PDFs or local ingestion tools. It only requires:

Supabase URL
Supabase service role key
Cloudflare account ID
Cloudflare API token
embedding/LLM configuration variables
Runtime Embedding Modes

The app supports two query embedding modes.

Recommended: Cloudflare Query Embeddings
EMBEDDING_PROVIDER=cloudflare

This is the default and recommended deployment mode.

In this mode:

The lab computer is only needed for paper ingestion.
The deployed app remains fully functional on Vercel.
Cloudflare is used for one small query embedding per question.
Cloudflare is also used for final answer generation.
Advanced: Local HTTP Query Embeddings
EMBEDDING_PROVIDER=local_http
LOCAL_EMBEDDING_API_URL=
LOCAL_EMBEDDING_API_KEY=

This mode sends runtime query embeddings to a local FastAPI embedding server.

Use this only if the lab computer is always online and reachable from the deployed app.

Run the optional server with:

cd local-tools
source .venv/bin/activate
uvicorn scripts.embedding_server:app --host 0.0.0.0 --port 8001
RAG Behavior

The assistant follows strict retrieval-grounded behavior:

Answers only from retrieved paper excerpts.
Refuses questions outside the indexed paper database.
Cites paper title, year, and page number.
Does not invent paper titles, authors, page numbers, or links.
Returns source cards for transparency.
Avoids calling the LLM if no sufficiently relevant chunks are found.

Default refusal:

Sorry, I can only answer based on the Cho Lab paper database. I could not find enough evidence in the available papers.
Cost Design

The system is optimized to minimize hosted AI usage.

Bulk work is local:

PDF extraction
chunking
document embeddings
vector upload

Hosted AI is used only at runtime:

one query embedding per question
one final answer generation call

This avoids using Cloudflare Workers AI quota for bulk document ingestion while keeping the deployed app simple and reliable.

Git Hygiene

The repository intentionally excludes:

environment files
local PDFs
Python virtual environments
Node dependencies
Next.js build output

Important ignored paths include:

.env.local
web/.env.local
local-tools/.env.local
local-tools/.venv/
web/node_modules/
web/.next/
local-tools/papers/*

Do not commit API keys, service role keys, PDFs, node_modules, or virtual environments.

Development Workflow

Typical workflow for adding papers:

Add PDFs to local-tools/papers/.
Add metadata entries to local-tools/metadata/papers.json.
Run local ingestion.
Confirm rows exist in Supabase.
Test the web app locally.
Deploy or redeploy the Vercel app if code changed.

Typical workflow for code updates:

Update code in web/, local-tools/, or supabase/.
Test locally.
Commit only source files and configuration templates.
Push to GitHub.
Vercel deploys from web/.
Status

Current MVP capabilities:

Local paper ingestion
Local document embeddings
Supabase vector search
Cloudflare-powered answer generation
Source-grounded citations
Vercel-ready web app
Optional local embedding server

Planned improvements may include:

Admin upload interface
Better hybrid search
reranking
answer feedback buttons
analytics dashboard
integration into the main Cho Lab website

One small note: if your project uses `npm` and has `package-lock.json`, keep it. If not, remove the “package-lock” mention from the structure.
```
