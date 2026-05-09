# web/ — Cho Lab Paper Assistant (Next.js)

This is the only folder that gets deployed to Vercel.

---

## Local development

### 1. Install dependencies

```bash
cd web
npm install
```

### 2. Create .env.local

```bash
cp .env.example .env.local
```

Fill in your values:

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_LLM_MODEL=@cf/meta/llama-3.1-8b-instruct-fp8-fast
CLOUDFLARE_EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5
EMBEDDING_PROVIDER=cloudflare
MATCH_COUNT=6
MATCH_THRESHOLD=0.35
```

> The lab computer does NOT need to run for the web app to work.
> Ingestion only needs to be run once per paper update.

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

---

## Deploying to Vercel

1. Push the repository to GitHub.
2. Go to https://vercel.com → **Add New Project** → import your repo.
3. **Set the root directory to `web`** (Vercel Project Settings → General → Root Directory).
4. Vercel will auto-detect Next.js. No build command changes needed.
5. Add environment variables in **Vercel → Project → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://YOUR_PROJECT_ID.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
| `CLOUDFLARE_ACCOUNT_ID` | your Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | your Cloudflare API token |
| `CLOUDFLARE_LLM_MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` |
| `CLOUDFLARE_EMBEDDING_MODEL` | `@cf/baai/bge-base-en-v1.5` |
| `EMBEDDING_PROVIDER` | `cloudflare` |
| `MATCH_COUNT` | `6` |
| `MATCH_THRESHOLD` | `0.35` |

6. Click **Deploy**.

---

## Embedding provider modes

### `EMBEDDING_PROVIDER=cloudflare` (default, recommended)

- Cloudflare handles query embedding at runtime (~1 API call per user question).
- Lab computer does **not** need to be online after ingestion is done.
- Works out of the box on Vercel.

### `EMBEDDING_PROVIDER=local_http`

- Your lab's `embedding_server.py` handles query embedding.
- Lab computer must be online and reachable from Vercel (needs Cloudflare Tunnel or ngrok).
- Add these env vars:
  ```
  EMBEDDING_PROVIDER=local_http
  LOCAL_EMBEDDING_API_URL=https://your-tunnel.trycloudflare.com/embed
  LOCAL_EMBEDDING_API_KEY=optional_secret
  ```

---

## What is NOT deployed

- PDF files (gitignored)
- Python scripts (`local-tools/`)
- Ingestion script
- `local-tools/` directory

The deployed app only reads from Supabase and calls Cloudflare.
