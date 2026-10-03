// Every Nimzo table, type and function in Postgres is prefixed nimzo_ because
// the Supabase project is shared with other apps. Always reference them via T / RPC.
const TABLES = [
  "taxonomy_tags", "openings", "settings", "chesscom_archives", "sessions", "games", "positions",
  "mistakes", "game_reviews", "knowledge_documents", "lessons", "lesson_chunks", "puzzles",
  "puzzle_attempts", "chat_threads", "chat_messages", "error_log",
] as const;

type Table = (typeof TABLES)[number];

export const T = Object.fromEntries(TABLES.map((t) => [t, `nimzo_${t}`])) as { [K in Table]: `nimzo_${K}` };

export const RPC = { pattern_stats: "nimzo_pattern_stats" } as const;

export const KNOWLEDGE_BUCKET = "nimzo-knowledge";
