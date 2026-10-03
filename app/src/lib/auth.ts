import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env, sameEmail } from "@/lib/env";

/** For server components and routes: returns the owner's Supabase client or redirects. */
export async function requireOwner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  if (typeof email !== "string" || !sameEmail(email, env().ALLOWED_EMAIL)) redirect("/login");
  return supabase;
}

/** For API route handlers: returns null when the caller isn't the owner. */
export async function ownerOrNull() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  if (typeof email !== "string" || !sameEmail(email, env().ALLOWED_EMAIL)) return null;
  return supabase;
}
