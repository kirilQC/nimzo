import "server-only";
import { db } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";

/** Central error log: console plus a row in nimzo_error_log. Never throws. */
export async function logError(scope: string, error: unknown, detail?: Record<string, unknown>, gameId?: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${scope}]`, message, detail ?? "");
  try {
    const client = await db();
    await client.from(T.error_log).insert({
      scope,
      message,
      game_id: gameId ?? null,
      detail: { ...detail, stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : undefined },
    });
  } catch {
    // logging must never break the caller
  }
}
