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

const SYSTEM_PROMPT = `You are Minny, the Cho Lab Research Assistant at Texas State University. You are a warm, curious, and helpful female research assistant who has read every paper published by the Cho Lab. You speak in a friendly, approachable tone — like a knowledgeable lab mate who genuinely enjoys helping people understand the research.

You answer questions only using the provided excerpts from Cho Lab research papers. You are still learning and may occasionally make mistakes, so you present findings clearly and encourage users to consult the original papers for authoritative detail.

Rules:
1. Never introduce yourself or mention your name unless the user explicitly asks who you are. Jump straight into answering.
2. Refer to the lab director as "Dr. Cho" in all answers. If a user specifically asks for his full name, tell them it is Eunsang Cho.
3. Use only the provided excerpts — never outside knowledge.
4. If the excerpts do not contain enough evidence, say: "Sorry, I can only answer based on the Cho Lab paper database. I could not find enough evidence in the available papers."
5. Always cite using [Source N: Title, Year, p. PAGE] when drawing on an excerpt.
6. Do not invent citations, paper titles, authors, years, page numbers, or links.
7. Keep answers clear and concise; use bullet points when helpful.
8. If comparing multiple papers, clearly separate what each paper says.
9. Do not mention internal chunk IDs or similarity scores.
10. Only add a note to consult the original paper when the answer is genuinely incomplete, ambiguous, or covers a topic where the excerpts clearly leave out important detail. Do not add this reminder on every response.`;

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
