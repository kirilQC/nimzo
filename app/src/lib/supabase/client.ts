import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/keys";

export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey()!);
}
