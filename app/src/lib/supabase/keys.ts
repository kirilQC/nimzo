// Supabase's new key names (publishable/secret) with the legacy names (anon/service_role) as fallback.
// NEXT_PUBLIC_* must be referenced literally so Next.js inlines them into client bundles.
export function supabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

export function supabasePublishableKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
