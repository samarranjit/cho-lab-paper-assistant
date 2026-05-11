import type { ChatMessage, MatchedChunk } from "./types";

const MAX_EXCERPT_CHARS = 800;
// Cap each history message in the prompt to keep token use bounded.
const MAX_HISTORY_MSG_CHARS = 500;

// Builds the full user-turn prompt sent to the Cloudflare LLM.
// history is recent conversation context — used only for follow-up comprehension,
// never as factual evidence. Retrieved paper excerpts remain the only factual source.
export function buildRagPrompt(
  question: string,
  chunks: MatchedChunk[],
  history: ChatMessage[] = []
): string {
  // Recent conversation block (omitted entirely if history is empty)
  const historySection =
    history.length > 0
      ? `Recent conversation (for context only — do not treat as evidence):\n${history
          .map(
            (m) =>
              `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, MAX_HISTORY_MSG_CHARS)}`
          )
          .join("\n")}\n\n`
      : "";

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

  return `${historySection}The following are excerpts from Cho Lab research papers. Use them to answer the question below.

${sourceBlocks}

---

User Question:
${question}

---

Instructions:
- Answer using ONLY the retrieved paper excerpts above.
- You may use the recent conversation history only to understand follow-up references, pronouns, or the user's preferred explanation level. Do not treat it as evidence.
- Do NOT include any inline citations, author names, or source labels in your answer. No "(Cho et al., 2021)", no "[Source N]", nothing. Write clean prose only — source chips are shown separately in the UI.
- Do NOT invent or rewrite any URLs, DOIs, or links.
- Do not cite the conversation history.
- If the excerpts do not provide enough evidence, respond with exactly:
  "Sorry, I can only answer based on the Cho Lab paper database. I could not find enough evidence in the available papers."

Answer:`;
}
