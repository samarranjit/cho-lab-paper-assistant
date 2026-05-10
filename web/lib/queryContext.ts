// Retrieval query enrichment for follow-up questions.
//
// When a user asks "How is that different from snowmelt?" or "What about California?",
// the question alone is too vague for meaningful vector search. By prepending the most
// recent prior user message, we give the embedding more semantic context without any
// extra LLM call or stored state. This is purely deterministic string construction.
//
// The enriched query is used only for embedding + Supabase retrieval.
// The original question is kept unchanged for the LLM answer generation prompt.

import type { ChatMessage } from "./types";

export function buildRetrievalQuery(
  question: string,
  history: ChatMessage[]
): string {
  // Find the most recent prior user message
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
  if (!lastUserMsg || lastUserMsg.content === question) return question;

  // Concatenate for richer retrieval context, capped to avoid bloating the embedding
  const context = lastUserMsg.content.slice(0, 400);
  return `${context} ${question}`;
}
