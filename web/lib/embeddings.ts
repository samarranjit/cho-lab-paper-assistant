// Query-time embedding provider.
//
// Document embeddings are always generated LOCALLY (ingest_local.py) using
// BAAI/bge-base-en-v1.5 with normalize_embeddings=True.
//
// This file handles only the single embedding call per user question.
//
// ┌──────────────────┬──────────────────────────────────────────────────────┐
// │ EMBEDDING_PROVIDER │ Behavior                                           │
// ├──────────────────┼──────────────────────────────────────────────────────┤
// │ cloudflare        │ 1 Cloudflare neuron per question.                   │
// │ (default)         │ Works on Vercel with no extra infrastructure.       │
// │                   │ Lab computer does NOT need to run at runtime.       │
// │                   │ Compatible: CF uses the same BGE model + L2 norm.   │
// ├──────────────────┼──────────────────────────────────────────────────────┤
// │ local_http        │ Calls scripts/embedding_server.py on your lab PC.   │
// │                   │ Zero Cloudflare cost at runtime.                    │
// │                   │ Lab computer MUST be online and reachable by Vercel │
// │                   │ (requires Cloudflare Tunnel, ngrok, or static IP).  │
// └──────────────────┴──────────────────────────────────────────────────────┘

const PROVIDER = (process.env.EMBEDDING_PROVIDER ?? "cloudflare") as
  | "cloudflare"
  | "local_http";

// ── Cloudflare provider ───────────────────────────────────────────────────────

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_EMBED_MODEL =
  process.env.CLOUDFLARE_EMBEDDING_MODEL ?? "@cf/baai/bge-base-en-v1.5";

async function embedViaCf(text: string): Promise<number[]> {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error(
      "[embeddings] EMBEDDING_PROVIDER=cloudflare but " +
        "CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing."
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_EMBED_MODEL}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[embeddings] Cloudflare embed failed (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  return extractCfEmbedding(data);
}

// Cloudflare response shape varies — try all known locations.
function extractCfEmbedding(data: Record<string, unknown>): number[] {
  const result = data?.result as Record<string, unknown> | undefined;
  if (result) {
    // Format 1: result.data[0] as array or { embedding: [...] }
    const arr = result.data as unknown[] | undefined;
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      if (Array.isArray(first)) return first as number[];
      if (
        typeof first === "object" &&
        first !== null &&
        Array.isArray((first as Record<string, unknown>).embedding)
      ) {
        return (first as Record<string, unknown>).embedding as number[];
      }
    }
    // Format 2: result.embeddings[0]
    const embeddings = result.embeddings as unknown[] | undefined;
    if (Array.isArray(embeddings) && Array.isArray(embeddings[0])) {
      return embeddings[0] as number[];
    }
    // Format 3: result is the array
    if (Array.isArray(result)) return result as number[];
  }
  throw new Error(
    `[embeddings] Unexpected Cloudflare response: ${JSON.stringify(data).slice(0, 400)}`
  );
}

// ── Local HTTP provider ───────────────────────────────────────────────────────

const LOCAL_URL =
  process.env.LOCAL_EMBEDDING_API_URL ?? "http://localhost:8001/embed";
const LOCAL_KEY = process.env.LOCAL_EMBEDDING_API_KEY ?? "";

async function embedViaLocalApi(text: string): Promise<number[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (LOCAL_KEY) headers["x-api-key"] = LOCAL_KEY;

  const res = await fetch(LOCAL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[embeddings] Local embed API failed (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as { embedding?: number[] };
  if (!Array.isArray(data?.embedding)) {
    throw new Error(
      `[embeddings] Local API returned unexpected shape: ${JSON.stringify(data).slice(0, 200)}`
    );
  }
  return data.embedding;
}

// ── Public API ────────────────────────────────────────────────────────────────

// Embeds a single user query string using the configured provider.
// Returns a 768-dim normalized float array compatible with document embeddings.
export async function embedQuery(text: string): Promise<number[]> {
  if (PROVIDER === "local_http") {
    return embedViaLocalApi(text);
  }
  return embedViaCf(text);
}
