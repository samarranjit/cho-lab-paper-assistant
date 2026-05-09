// Shared types for the Cho Lab Paper Assistant web app

// ── Paper metadata (mirrors the papers table) ─────────────────────────────────

export interface PaperMetadata {
  paper_key: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  abstract: string;
  doi: string;
  keywords: string;
  source_url: string;
  pdf_url: string;
  best_link: string;
  local_path: string;
}

// ── Supabase match_paper_chunks RPC result ────────────────────────────────────
// Column list must stay in sync with the SQL function in supabase/schema.sql

export interface MatchedChunk {
  id: string;
  paper_id: string;
  paper_key: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  doi: string;
  page: number;
  chunk_index: number;
  chunk_text: string;
  source_url: string;
  pdf_url: string;
  best_link: string;
  similarity: number;
}

// ── API request / response ────────────────────────────────────────────────────

export interface AskRequest {
  question: string;
}

export interface Source {
  sourceNumber: number;
  id: string;
  paper_key: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  doi: string;
  page: number;
  source_url: string;
  pdf_url: string;
  best_link: string;
  similarity: number;
  excerpt: string;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
  usedFallback?: boolean;
}
