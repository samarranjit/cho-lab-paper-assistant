import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { embedQuery } from "@/lib/embeddings";
import { generateAnswer } from "@/lib/cloudflare";
import { buildRagPrompt } from "@/lib/prompts";
import type { AskResponse, MatchedChunk, Source } from "@/lib/types";

const MAX_QUESTION_LENGTH = 1500;

// Configurable retrieval parameters — tune via Vercel env vars without a redeploy
const MATCH_COUNT = parseInt(process.env.MATCH_COUNT ?? "6", 10);
const MATCH_THRESHOLD = parseFloat(process.env.MATCH_THRESHOLD ?? "0.35");

const NO_SOURCES_ANSWER =
  "Sorry, I can only answer based on the Cho Lab paper database. " +
  "I could not find enough evidence in the available papers to answer your question.";

const LLM_FAILURE_ANSWER =
  "I found relevant Cho Lab paper excerpts, but the AI answer service was temporarily unavailable. " +
  "Here are the most relevant sources to review directly.";

// best_link is stored in DB by ingest_local.py — compute it here as fallback
// for any chunks that pre-date the column addition.
function resolveLink(chunk: MatchedChunk): string {
  if (chunk.best_link) return chunk.best_link;
  if (chunk.source_url?.startsWith("http")) return chunk.source_url;
  if (chunk.pdf_url?.startsWith("http")) return chunk.pdf_url;
  if (chunk.doi) {
    return chunk.doi.startsWith("https://doi.org/")
      ? chunk.doi
      : `https://doi.org/${chunk.doi}`;
  }
  return "";
}

// Keep the highest-similarity chunk per paper so source cards don't repeat the same paper.
function deduplicateByPaper(chunks: MatchedChunk[]): MatchedChunk[] {
  const seen = new Map<string, MatchedChunk>();
  for (const c of chunks) {
    const existing = seen.get(c.paper_key);
    if (!existing || c.similarity > existing.similarity) {
      seen.set(c.paper_key, c);
    }
  }
  return Array.from(seen.values());
}

function toSource(chunk: MatchedChunk, num: number): Source {
  return {
    sourceNumber: num,
    id: chunk.id,
    paper_key: chunk.paper_key,
    title: chunk.title,
    authors: chunk.authors ?? "",
    year: chunk.year,
    journal: chunk.journal ?? "",
    doi: chunk.doi ?? "",
    page: chunk.page,
    source_url: chunk.source_url ?? "",
    pdf_url: chunk.pdf_url ?? "",
    best_link: resolveLink(chunk),
    similarity: Math.round(chunk.similarity * 1000) / 1000,
    excerpt: chunk.chunk_text.slice(0, 300),
  };
}

export async function POST(req: NextRequest) {
  // ── Parse & validate ───────────────────────────────────────────────────────
  let question: string;
  try {
    const body = await req.json();
    question = typeof body?.question === "string" ? body.question.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ error: "Question cannot be empty." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Question too long. Max ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // ── Step 1: Embed question ─────────────────────────────────────────────────
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(question);
  } catch (err) {
    console.error("[ask] Embedding failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to process your question. Please try again." },
      { status: 503 }
    );
  }

  // ── Step 2: Vector search ──────────────────────────────────────────────────
  let chunks: MatchedChunk[] = [];
  try {
    const { data, error } = await supabase.rpc("match_paper_chunks", {
      query_embedding: queryEmbedding,
      match_count: MATCH_COUNT,
      match_threshold: MATCH_THRESHOLD,
    });
    if (error) {
      console.error("[ask] Supabase RPC error:", error.message);
      return NextResponse.json(
        { error: "Failed to search paper database. Please try again." },
        { status: 503 }
      );
    }
    chunks = (data as MatchedChunk[]) ?? [];
  } catch (err) {
    console.error("[ask] Supabase fetch failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Failed to search paper database. Please try again." },
      { status: 503 }
    );
  }

  // No strong sources — refuse without spending Cloudflare neurons
  if (chunks.length === 0) {
    return NextResponse.json<AskResponse>({
      answer: NO_SOURCES_ANSWER,
      sources: [],
      usedFallback: true,
    });
  }

  const unique = deduplicateByPaper(chunks);
  const sources = unique.map((c, i) => toSource(c, i + 1));

  // ── Step 3: Generate answer ────────────────────────────────────────────────
  const prompt = buildRagPrompt(question, unique);
  let answer: string;
  let usedFallback = false;

  try {
    answer = await generateAnswer(prompt);
  } catch (err) {
    // LLM failed — return sources as graceful fallback instead of an error page
    console.error("[ask] Cloudflare LLM failed:", err instanceof Error ? err.message : err);
    answer = LLM_FAILURE_ANSWER;
    usedFallback = true;
  }

  return NextResponse.json<AskResponse>({ answer, sources, usedFallback });
}
