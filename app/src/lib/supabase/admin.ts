import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { env } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * Server-only Supabase client using the secret key. Nimzo has no sign-in:
 * every read and write happens on the server through this client. The browser
 * never talks to Supabase directly, and RLS (enabled with no policies) blocks
 * the publishable key from reading anything.
 *
 * Awaiting connection() marks the caller as request-time, so pages that read
 * data are never prerendered at build time.
 */
export async function db(): Promise<SupabaseClient> {
  await connection();
  if (client) return client;
  const e = env();
  client = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
