#!/usr/bin/env python3
"""
Cho Lab — local paper ingestion script.

Reads PDFs from local-tools/papers/, embeds chunks using a local
BAAI/bge-base-en-v1.5 model, and stores everything in Supabase.

Zero Cloudflare calls. Safe to re-run — old chunks are replaced, never duplicated.

Usage (run from the local-tools/ directory):
    python scripts/ingest_local.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

# ── Locate project root and load .env.local ────────────────────────────────────
# This script lives in local-tools/scripts/ — the "local-tools" root is one level up.
TOOLS_ROOT = Path(__file__).parent.parent
PROJECT_ROOT = TOOLS_ROOT.parent

from dotenv import load_dotenv  # noqa: E402 (import after path setup)

# Try local-tools/.env.local first, then the repo root .env.local
load_dotenv(TOOLS_ROOT / ".env.local")
load_dotenv(PROJECT_ROOT / ".env.local", override=False)

import pdfplumber  # noqa: E402
from sentence_transformers import SentenceTransformer  # noqa: E402
from supabase import create_client, Client  # noqa: E402

# ── Config ─────────────────────────────────────────────────────────────────────

CHUNK_SIZE = 3000       # target characters per chunk
CHUNK_OVERLAP = 400     # character overlap between consecutive chunks
MIN_CHUNK_LEN = 80      # discard chunks shorter than this
EMBED_BATCH = 32        # texts per SentenceTransformer encode call
INSERT_BATCH = 50       # rows per Supabase insert

# ── Validate environment ───────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
MODEL_NAME = os.environ.get("LOCAL_EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")

missing = [k for k, v in {
    "SUPABASE_URL": SUPABASE_URL,
    "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_KEY,
}.items() if not v]

if missing:
    print(f"❌  Missing environment variables: {', '.join(missing)}")
    print("    Check local-tools/.env.local")
    sys.exit(1)

# ── Clients ────────────────────────────────────────────────────────────────────

db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print(f"Loading embedding model: {MODEL_NAME}")
model = SentenceTransformer(MODEL_NAME)
print("Model ready.\n")

# ── Text helpers ───────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_page(text: str, page: int, global_start: int) -> list[dict]:
    """Split one page's text into overlapping chunks. Returns chunk dicts."""
    cleaned = clean_text(text)
    if len(cleaned) < MIN_CHUNK_LEN:
        return []

    chunks = []
    pos = 0
    local_idx = 0

    while pos < len(cleaned):
        end = min(pos + CHUNK_SIZE, len(cleaned))
        snippet = cleaned[pos:end].strip()
        if len(snippet) >= MIN_CHUNK_LEN:
            chunks.append({
                "page": page,
                "chunk_index": global_start + local_idx,
                "chunk_text": snippet,
                "char_count": len(snippet),
            })
            local_idx += 1
        if end >= len(cleaned):
            break
        pos = end - CHUNK_OVERLAP

    return chunks


def chunk_all_pages(page_texts: list[str]) -> list[dict]:
    """Chunk every page, assigning correct 1-based page numbers and a global index."""
    all_chunks: list[dict] = []
    for i, text in enumerate(page_texts):
        page_chunks = chunk_page(text, page=i + 1, global_start=len(all_chunks))
        all_chunks.extend(page_chunks)
    return all_chunks

# ── PDF extraction ─────────────────────────────────────────────────────────────

def extract_pages(pdf_path: Path) -> list[str]:
    """Return a list of page texts using pdfplumber."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return pages

# ── Embedding ──────────────────────────────────────────────────────────────────

def embed_chunks(chunks: list[dict]) -> list[list[float]]:
    """Return L2-normalized 768-dim embeddings for all chunk texts."""
    texts = [c["chunk_text"] for c in chunks]
    embeddings = model.encode(
        texts,
        batch_size=EMBED_BATCH,
        normalize_embeddings=True,
        show_progress_bar=True,
    )
    return [emb.tolist() for emb in embeddings]

# ── Supabase helpers ───────────────────────────────────────────────────────────

def resolve_best_link(paper: dict) -> str:
    if (paper.get("best_link") or "").startswith("http"):
        return paper["best_link"]
    if (paper.get("source_url") or "").startswith("http"):
        return paper["source_url"]
    if (paper.get("pdf_url") or "").startswith("http"):
        return paper["pdf_url"]
    doi = paper.get("doi", "")
    if doi:
        return doi if doi.startswith("https://doi.org/") else f"https://doi.org/{doi}"
    return ""


def upsert_paper(paper: dict) -> str:
    """Upsert paper metadata and return the Supabase row UUID."""
    row = {
        "paper_key":  paper["paper_key"],
        "title":      paper["title"],
        "authors":    paper.get("authors", ""),
        "year":       paper.get("year"),
        "journal":    paper.get("journal", ""),
        "abstract":   paper.get("abstract", ""),
        "doi":        paper.get("doi", ""),
        "keywords":   paper.get("keywords", ""),
        "source_url": paper.get("source_url", ""),
        "pdf_url":    paper.get("pdf_url", ""),
        "best_link":  resolve_best_link(paper),
        "local_path": paper.get("local_path", ""),
        "updated_at": "now()",
    }
    result = db.table("papers").upsert(row, on_conflict="paper_key").execute()
    return result.data[0]["id"]


def delete_old_chunks(paper_key: str) -> None:
    """Remove all existing chunks for this paper_key before re-inserting."""
    db.table("paper_chunks").delete().eq("paper_key", paper_key).execute()


def insert_chunks(
    paper_id: str,
    paper: dict,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> None:
    """Insert all chunk rows in batches of INSERT_BATCH."""
    best_link = resolve_best_link(paper)
    rows = [
        {
            "paper_id":    paper_id,
            "paper_key":   paper["paper_key"],
            "title":       paper["title"],
            "authors":     paper.get("authors", ""),
            "year":        paper.get("year"),
            "journal":     paper.get("journal", ""),
            "doi":         paper.get("doi", ""),
            "page":        c["page"],
            "chunk_index": c["chunk_index"],
            "chunk_text":  c["chunk_text"],
            "source_url":  paper.get("source_url", ""),
            "pdf_url":     paper.get("pdf_url", ""),
            "best_link":   best_link,
            "char_count":  c["char_count"],
            "embedding":   emb,
        }
        for c, emb in zip(chunks, embeddings)
    ]

    total = len(rows)
    for i in range(0, total, INSERT_BATCH):
        batch = rows[i : i + INSERT_BATCH]
        db.table("paper_chunks").insert(batch).execute()
        print(f"    Uploaded {min(i + INSERT_BATCH, total)}/{total} chunks")

# ── Per-paper processing ───────────────────────────────────────────────────────

def process_paper(paper: dict) -> None:
    # local_path is relative to local-tools/
    pdf_path = TOOLS_ROOT / paper["local_path"]

    if not pdf_path.exists():
        print(f"  ⚠️  PDF not found, skipping:\n     {pdf_path}")
        return

    print(f"\n📄 {paper['title']}")
    print(f"   key: {paper['paper_key']}")

    print("  → Extracting text from PDF …")
    pages = extract_pages(pdf_path)
    print(f"  → Pages extracted: {len(pages)}")

    print("  → Chunking pages …")
    chunks = chunk_all_pages(pages)
    print(f"  → Chunks created: {len(chunks)}")

    if not chunks:
        print("  ⚠️  No usable chunks — PDF may be image-only. Skipping.")
        return

    print("  → Generating local embeddings …")
    t0 = time.time()
    embeddings = embed_chunks(chunks)
    print(f"  → Embedded {len(embeddings)} chunks in {time.time() - t0:.1f}s")

    print("  → Upserting paper metadata …")
    paper_id = upsert_paper(paper)

    print("  → Deleting old chunks …")
    delete_old_chunks(paper["paper_key"])

    print("  → Inserting new chunks …")
    insert_chunks(paper_id, paper, chunks, embeddings)

    print(f"  ✅ Done: {paper['title']}")

# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=== Cho Lab Local Ingestion ===\n")

    meta_path = TOOLS_ROOT / "metadata" / "papers.json"
    if not meta_path.exists():
        print(f"❌  metadata/papers.json not found at:\n   {meta_path}")
        sys.exit(1)

    papers: list[dict] = json.loads(meta_path.read_text(encoding="utf-8"))
    print(f"Found {len(papers)} paper(s) in metadata/papers.json\n")

    succeeded = 0
    failed = 0

    for paper in papers:
        try:
            process_paper(paper)
            succeeded += 1
        except Exception as exc:
            title = paper.get("title") or paper.get("paper_key") or "unknown"
            print(f"\n❌  Failed: {title}")
            print(f"   Error: {exc}")
            failed += 1

    print("\n=== Ingestion Complete ===")
    print(f"✅  Succeeded: {succeeded}")
    if failed:
        print(f"❌  Failed:    {failed}")


if __name__ == "__main__":
    main()
