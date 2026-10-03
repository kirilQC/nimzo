import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, sameEmail } from "@/lib/env";

/**
 * Magic-link landing. Accepts both the PKCE `?code=` flow and the
 * `?token_hash=&type=` flow, then records the allowed user as the app owner
 * (which is what RLS checks).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (error) return NextResponse.redirect(new URL("/login?error=link", request.url));

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !sameEmail(user.email, env().ALLOWED_EMAIL)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_allowed", request.url));
  }

  const admin = createAdminClient();
  const { error: ownerError } = await admin
    .from("app_owner")
    .upsert({ id: true, user_id: user.id, email: user.email! }, { onConflict: "id" });
  if (ownerError) {
    console.error("[auth] could not record owner", ownerError);
    return NextResponse.redirect(new URL("/login?error=owner", request.url));
  }

  return NextResponse.redirect(new URL("/", request.url));
}
