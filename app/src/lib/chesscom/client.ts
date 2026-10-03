import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { archivesSchema, monthArchiveSchema, statsSchema } from "./schema";

/*
 * chess.com Published-Data API client.
 *
 * FAIR PLAY: this is Nimzo's only connection to chess.com, and it only ever
 * reads FINISHED games from the public monthly archives (which by design
 * contain completed games only). Nimzo must never read a live board, poll a
 * game in progress, or give any hint or alert during a chess.com game. Live
 * blunder feedback exists only in Nimzo's own Practice mode, against Nimzo's
 * own engine. Don't add endpoints or features here that touch ongoing games.
 *
 * chess.com rate-limits parallel requests (HTTP 429), so every request goes
 * through one serial queue.
 */

const BASE = "https://api.chess.com/pub";

let queue: Promise<unknown> = Promise.resolve();

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function userAgent(): string {
  const e = env();
  return `Nimzo/1.0 (personal project; username: ${e.CHESSCOM_USERNAME}; contact: ${e.CONTACT_EMAIL})`;
}

export class ChesscomError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Conditional = { etag?: string | null; lastModified?: string | null };

export type FetchResult<T> =
  | { status: "not_modified" }
  | { status: "not_found" }
  | { status: "ok"; data: T; etag: string | null; lastModified: string | null };

async function getJson<T>(url: string, schema: z.ZodType<T>, cond: Conditional = {}): Promise<FetchResult<T>> {
  return serial(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const headers: Record<string, string> = { "User-Agent": userAgent(), Accept: "application/json" };
      if (cond.etag) headers["If-None-Match"] = cond.etag;
      if (cond.lastModified) headers["If-Modified-Since"] = cond.lastModified;

      const res = await fetch(url, { headers, cache: "no-store" });
      if (res.status === 304) return { status: "not_modified" } as const;
      if (res.status === 404) return { status: "not_found" } as const;
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new ChesscomError(`chess.com ${res.status} for ${url}`, res.status);

      const parsed = schema.safeParse(await res.json());
      if (!parsed.success) throw new ChesscomError(`Unexpected chess.com response for ${url}: ${parsed.error.message}`, 502);
      return { status: "ok", data: parsed.data, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") } as const;
    }
    throw new ChesscomError(`chess.com kept rate-limiting ${url}`, 429);
  });
}

const player = () => `${BASE}/player/${encodeURIComponent(env().CHESSCOM_USERNAME.toLowerCase())}`;

export function monthArchiveUrl(year: number, month: number): string {
  return `${player()}/games/${year}/${String(month).padStart(2, "0")}`;
}

export const chesscom = {
  archives: () => getJson(`${player()}/games/archives`, archivesSchema),
  month: (url: string, cond?: Conditional) => getJson(url, monthArchiveSchema, cond),
  stats: () => getJson(`${player()}/stats`, statsSchema),
};
