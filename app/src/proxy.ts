import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/keys";

const PUBLIC_PATHS = ["/login", "/auth/"];

/**
 * Refreshes the Supabase session cookie on every request and sends anyone who
 * isn't the single allowed user to /login. This is the optimistic gate; RLS
 * (public.is_owner()) is the real one.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey()!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const isAllowed = !!email && !!allowed && email.toLowerCase() === allowed;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p));

  if (!isAllowed && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = email ? "?error=not_allowed" : "";
    return NextResponse.redirect(url);
  }
  if (isAllowed && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static files, images and icon/manifest assets.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|brand/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
