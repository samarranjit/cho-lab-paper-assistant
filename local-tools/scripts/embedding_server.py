#!/usr/bin/env python3
"""
Optional local embedding server for query-time embeddings.

When EMBEDDING_PROVIDER=local_http in the web app, Vercel calls this server
instead of Cloudflare for query embeddings. This means zero Cloudflare neuron
cost at runtime — but the server must be running and reachable from the internet.

IMPORTANT:
  If you use EMBEDDING_PROVIDER=cloudflare (the default), this server is NOT needed.
  The lab computer only needs to run when ingesting new papers.

Usage:
    cd local-tools
    source .venv/bin/activate
    uvicorn scripts.embedding_server:app --host 0.0.0.0 --port 8001

To expose it to the internet (required for Vercel to reach it):
    cloudflared tunnel --url http://localhost:8001
    # or: ngrok http 8001

Set in web/.env.local (or Vercel env vars):
    EMBEDDING_PROVIDER=local_http
    LOCAL_EMBEDDING_API_URL=https://your-tunnel-url.trycloudflare.com/embed
    LOCAL_EMBEDDING_API_KEY=your_secret  # optional, must match below
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv

TOOLS_ROOT = Path(__file__).parent.parent
load_dotenv(TOOLS_ROOT / ".env.local")
load_dotenv(TOOLS_ROOT.parent / ".env.local", override=False)

from fastapi import FastAPI, Header, HTTPException  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from sentence_transformers import SentenceTransformer  # noqa: E402

# ── Config ─────────────────────────────────────────────────────────────────────

MODEL_NAME = os.environ.get("LOCAL_EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")
EXPECTED_KEY = os.environ.get("LOCAL_EMBEDDING_API_KEY", "")

# ── Model lifecycle ────────────────────────────────────────────────────────────

_model: SentenceTransformer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _model
    print(f"Loading {MODEL_NAME} …")
    _model = SentenceTransformer(MODEL_NAME)
    print("Model ready.")
    yield
    _model = None


app = FastAPI(title="Cho Lab Embedding Server", lifespan=lifespan)

# ── Schemas ────────────────────────────────────────────────────────────────────


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]
    model: str
    dimensions: int


# ── Routes ─────────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME, "loaded": _model is not None}


@app.post("/embed", response_model=EmbedResponse)
def embed(
    req: EmbedRequest,
    x_api_key: Annotated[str | None, Header()] = None,
):
    if EXPECTED_KEY and x_api_key != EXPECTED_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing x-api-key header.")

    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet.")

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text must not be empty.")

    emb = _model.encode(text, normalize_embeddings=True)
    return EmbedResponse(
        embedding=emb.tolist(),
        model=MODEL_NAME,
        dimensions=len(emb),
    )


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "scripts.embedding_server:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
    )
