import "server-only";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { logError } from "@/lib/log";
import { chesscom } from "./client";

export type PlayerInfo = { username: string; display_name: string; avatar_url: string | null; country_code: string | null; title: string | null };

const STALE_DAYS = 60;

/**
 * Fetches public chess.com profiles (avatar, country, title) for any of these
 * players not cached yet, or cached more than 60 days ago. Serial and polite:
 * goes through the same one-at-a-time queue as every chess.com request.
 */
export async function refreshPlayers(usernames: string[], opts: { limit?: number } = {}): Promise<{ fetched: number }> {
  const db = await getDb();
  const wanted = [...new Set(usernames.map((u) => u.toLowerCase()))];
  const known = new Map<string, string>();
  for (let i = 0; i < wanted.length; i += 200) {
    const { data } = await db.from(T.players).select("username, fetched_at").in("username", wanted.slice(i, i + 200));
    for (const r of data ?? []) known.set(r.username as string, r.fetched_at as string);
  }
  const cutoff = Date.now() - STALE_DAYS * 86_400_000;
  const todo = wanted.filter((u) => !known.has(u) || Date.parse(known.get(u)!) < cutoff).slice(0, opts.limit ?? Infinity);
  let fetched = 0;
  for (const u of todo) {
    try {
      const r = await chesscom.profile(u);
      const row =
        r.status === "ok"
          ? {
              username: u,
              display_name: r.data.username,
              avatar_url: r.data.avatar ?? null,
              country_code: r.data.country ? r.data.country.split("/").pop()!.toUpperCase() : null,
              title: r.data.title ?? null,
              league: r.data.league ?? null,
              profile_url: r.data.url ?? null,
              status: "found",
              fetched_at: new Date().toISOString(),
            }
          : { username: u, display_name: u, avatar_url: null, country_code: null, title: null, league: null, profile_url: null, status: "not_found", fetched_at: new Date().toISOString() };
      if (r.status === "not_modified") continue;
      const { error } = await db.from(T.players).upsert(row, { onConflict: "username" });
      if (error) throw new Error(error.message);
      fetched++;
    } catch (e) {
      await logError("chesscom.profile", e, { username: u });
    }
  }
  return { fetched };
}

/** Cached profiles for these players (missing ones just aren't in the map). */
export async function getPlayers(usernames: string[]): Promise<Map<string, PlayerInfo>> {
  const db = await getDb();
  const wanted = [...new Set(usernames.map((u) => u.toLowerCase()))];
  const out = new Map<string, PlayerInfo>();
  try {
    for (let i = 0; i < wanted.length; i += 200) {
      const { data, error } = await db.from(T.players).select("username, display_name, avatar_url, country_code, title").in("username", wanted.slice(i, i + 200));
      if (error) break; // table not created yet: show names only
      for (const r of (data ?? []) as PlayerInfo[]) out.set(r.username, r);
    }
  } catch {
    // ignore: profiles are decoration
  }
  return out;
}
