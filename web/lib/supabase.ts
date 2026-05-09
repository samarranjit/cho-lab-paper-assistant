// ── SERVER-SIDE ONLY ──────────────────────────────────────────────────────────
// Never import this file in a client component ("use client").
// The service role key bypasses all Row Level Security.
// Safe only in: API routes, Server Components, and local scripts.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Check your web/.env.local file or Vercel environment variable settings.\n" +
      "The URL should be https://PROJECT_ID.supabase.co (no /rest/v1/ suffix)."
  );
}

export const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
