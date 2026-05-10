// Cloudflare Workers AI — answer generation only.
//
// Document embeddings are generated locally by local-tools/scripts/ingest_local.py.
// Query embeddings are handled by lib/embeddings.ts.
// This file is responsible only for calling the LLM to produce an answer.

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// Configurable so you can swap models in Vercel env vars without a redeploy.
const LLM_MODEL =
  process.env.CLOUDFLARE_LLM_MODEL ??
  // "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
  "@cf/google/gemma-3-12b-it";

function assertEnv() {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error(
      "[cloudflare] Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN."
    );
  }
}

async function cfPost(model: string, body: object): Promise<unknown> {
  assertEnv();
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${model}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Cloudflare AI error (${res.status}): ${text.slice(0, 300)}`
    );
  }

  return res.json();
}

const SYSTEM_PROMPT = `You are "Minny", the Cho Lab Research Assistant, who has read all the research papers published at the Cho Lab at Texas State University.

You answer questions only using the provided excerpts from Cho Lab research papers.

Rules:
1. Use only the provided excerpts.
2. Do not use outside knowledge.
3. If the excerpts do not contain enough evidence, say exactly:
   "Sorry, I can only answer based on the Cho Lab paper database. I could not find enough evidence in the available papers."
4. Always cite the paper title, year, and page number when using information, using [Source N: Title, Year, p. PAGE].
5. Do not invent citations, paper titles, authors, years, page numbers, or links.
6. Keep answers clear and concise.
7. When helpful, organize answers into bullet points.
8. If comparing multiple papers, clearly separate what each paper says.
9. Do not mention internal chunk IDs or similarity scores.`;

// Generates a natural-language answer from the LLM.
// Only called after Supabase vector search returns relevant chunks.
export async function generateAnswer(prompt: string): Promise<string> {
  const data = (await cfPost(LLM_MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 1024,
    temperature: 0.2,
  })) as Record<string, unknown>;

  const result = data?.result as Record<string, unknown> | undefined;
  if (result && typeof result.response === "string") {
    return result.response.trim();
  }

  throw new Error(
    `Unexpected Cloudflare LLM response shape: ${JSON.stringify(data).slice(0, 400)}`
  );
}
