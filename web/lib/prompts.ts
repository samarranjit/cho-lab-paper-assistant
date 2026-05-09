import type { MatchedChunk } from "./types";

// Max characters per excerpt included in the prompt.
// Keeps prompt compact and within LLM context limits.
const MAX_EXCERPT_CHARS = 800;

// Builds the full user-turn prompt sent to the Cloudflare LLM.
// The system prompt is kept in lib/cloudflare.ts.
export function buildRagPrompt(
  question: string,
  chunks: MatchedChunk[]
): string {
  const sourceBlocks = chunks
    .map((chunk, i) => {
      const excerpt = chunk.chunk_text.slice(0, MAX_EXCERPT_CHARS).trim();
      return `[Source ${i + 1}]
Title: ${chunk.title}
Authors: ${chunk.authors || "Unknown"}
Year: ${chunk.year || "Unknown"}
Journal: ${chunk.journal || "Unknown"}
Page: ${chunk.page || "Unknown"}
Text:
${excerpt}`;
    })
    .join("\n\n");

  return `The following are excerpts from Cho Lab research papers. Use them to answer the question below.

${sourceBlocks}

---

User Question:
${question}

---

Instructions:
- Answer using ONLY the excerpts above.
- Cite each source you use inline as: [Source N: Title, Year, p. PAGE_NUMBER]
- Do NOT invent or rewrite any URLs, DOIs, or links — these will be shown in the source cards.
- If the excerpts do not provide enough evidence, respond with exactly:
  "Sorry, I can only answer based on the Cho Lab paper database. I could not find enough evidence in the available papers."

Answer:`;
}
