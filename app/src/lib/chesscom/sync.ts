import "server-only";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { logError } from "@/lib/log";
import { chesscom, monthArchiveUrl } from "./client";
import {
  addMonths,
  backfillArchives,
  mapGame,
  monthsToCheck,
  newGamesOnly,
  parseArchiveUrl,
  ratingsFromStats,
  utcYearMonth,
  type GameRow,
} from "./map";

// FAIR PLAY: sync only reads finished games from chess.com's monthly archives.
// See the note in ./client.ts before changing anything here.

const RATINGS_TTL_MS = 60 * 60 * 1000;

export type SyncResult = {
  mode: "backfill" | "incremental";
  checked: string[];
  notModified: string[];
  imported: number;
  skipped: number;
  newGameIds: string[];
  latestGameId: string | null;
};

type ArchiveRow = { url: string; etag: string | null; last_modified: string | null; last_checked_at: string | null };

export async function syncChesscom(opts: { sessionId?: string | null } = {}): Promise<SyncResult> {
  const db = await getDb();
  const username = env().CHESSCOM_USERNAME;
  const now = new Date();

  const [{ data: settings }, { data: archiveRows }, session] = await Promise.all([
    db.from(T.settings).select("backfill_months, ratings_fetched_at").single(),
    db.from(T.chesscom_archives).select("url, etag, last_modified, last_checked_at"),
    opts.sessionId
      ? db.from(T.sessions).select("id, started_at").eq("id", opts.sessionId).is("ended_at", null).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);
  const known = new Map((archiveRows ?? []).map((a: ArchiveRow) => [a.url, a]));

  // First run: no archive has ever been checked -> backfill the last N months.
  let targets: string[];
  let mode: SyncResult["mode"];
  if (known.size === 0) {
    mode = "backfill";
    const list = await chesscom.archives();
    const all = list.status === "ok" ? list.data.archives : [];
    targets = backfillArchives(all, now, settings?.backfill_months ?? 3);
  } else {
    mode = "incremental";
    const prevUrl = monthArchiveUrl(...ymArgs(addMonths(utcYearMonth(now), -1)));
    const prevChecked = known.get(prevUrl)?.last_checked_at;
    targets = monthsToCheck(now, prevChecked ? new Date(prevChecked) : null).map((ym) => monthArchiveUrl(ym.year, ym.month));
  }

  const result: SyncResult = { mode, checked: [], notModified: [], imported: 0, skipped: 0, newGameIds: [], latestGameId: null };

  for (const url of targets) {
    const prev = known.get(url);
    // During backfill fetch unconditionally; afterwards rely on ETag / Last-Modified.
    const res = await chesscom.month(url, mode === "incremental" ? { etag: prev?.etag, lastModified: prev?.last_modified } : {});
    result.checked.push(url);
    const ym = parseArchiveUrl(url) ?? utcYearMonth(now);

    if (res.status === "not_modified" || res.status === "not_found") {
      if (res.status === "not_modified") result.notModified.push(url);
      await db
        .from(T.chesscom_archives)
        .upsert({ url, year: ym.year, month: ym.month, last_checked_at: now.toISOString() }, { onConflict: "url" });
      continue;
    }

    const rows: GameRow[] = [];
    for (const raw of res.data.games) {
      const out = mapGame(raw, username, session ?? null);
      if ("row" in out) rows.push(out.row);
      else result.skipped++;
    }

    const fresh = await filterExisting(rows);
    if (fresh.length) {
      const { data: inserted, error } = await db
        .from(T.games)
        .upsert(fresh, { onConflict: "chesscom_url", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(`insert games: ${error.message}`);
      result.imported += inserted?.length ?? 0;
      result.newGameIds.push(...(inserted ?? []).map((r: { id: string }) => r.id));
    }

    await db.from(T.chesscom_archives).upsert(
      {
        url,
        year: ym.year,
        month: ym.month,
        etag: res.etag,
        last_modified: res.lastModified,
        last_checked_at: now.toISOString(),
        game_count: res.data.games.length,
      },
      { onConflict: "url" },
    );
  }

  // Mark the current month as checked even if it had no archive yet, so the
  // backfill runs once rather than on every sync.
  if (mode === "backfill") {
    const cur = utcYearMonth(now);
    const curUrl = monthArchiveUrl(cur.year, cur.month);
    if (!targets.includes(curUrl)) {
      await db
        .from(T.chesscom_archives)
        .upsert({ url: curUrl, year: cur.year, month: cur.month, last_checked_at: now.toISOString() }, { onConflict: "url" });
    }
  }

  if (session && result.imported > 0) {
    await db.from(T.sessions).update({ last_activity_at: now.toISOString() }).eq("id", session.id);
  }

  // Ratings snapshot (used for Maia level and puzzle difficulty), at most hourly.
  const fetchedAt = settings?.ratings_fetched_at ? new Date(settings.ratings_fetched_at).getTime() : 0;
  if (now.getTime() - fetchedAt > RATINGS_TTL_MS) {
    try {
      const stats = await chesscom.stats();
      if (stats.status === "ok") {
        await db
          .from(T.settings)
          .update({ ratings: ratingsFromStats(stats.data), ratings_fetched_at: now.toISOString(), chesscom_username: username })
          .eq("id", true);
      }
    } catch (e) {
      await logError("sync.ratings", e);
    }
  }

  const { data: latest } = await db
    .from(T.games)
    .select("id")
    .eq("source", "chesscom")
    .order("end_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  result.latestGameId = latest?.id ?? null;
  return result;
}

async function filterExisting(rows: GameRow[]): Promise<GameRow[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const existing: { chesscom_uuid: string | null; chesscom_url: string | null }[] = [];
  const urls = rows.map((r) => r.chesscom_url);
  for (let i = 0; i < urls.length; i += 200) {
    const { data, error } = await db.from(T.games).select("chesscom_uuid, chesscom_url").in("chesscom_url", urls.slice(i, i + 200));
    if (error) throw new Error(`dedupe lookup: ${error.message}`);
    existing.push(...(data ?? []));
  }
  const uuids = rows.map((r) => r.chesscom_uuid).filter((u): u is string => !!u);
  for (let i = 0; i < uuids.length; i += 200) {
    const { data, error } = await db.from(T.games).select("chesscom_uuid, chesscom_url").in("chesscom_uuid", uuids.slice(i, i + 200));
    if (error) throw new Error(`dedupe lookup: ${error.message}`);
    existing.push(...(data ?? []));
  }
  return newGamesOnly(rows, existing);
}

function ymArgs(ym: { year: number; month: number }): [number, number] {
  return [ym.year, ym.month];
}
