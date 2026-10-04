// Fetches chess.com profiles (avatar, country, title) for the player and every
// opponent in the imported games. One request at a time, like all chess.com calls.
// Usage (from app/): NIMZO_SCRIPT=1 npx tsx --conditions=react-server --env-file=.env.local scripts/fetch-players.mts
import { createClient } from "@supabase/supabase-js";
import { refreshPlayers } from "../src/lib/chesscom/players";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!);
const names = new Set<string>([process.env.CHESSCOM_USERNAME!]);
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("nimzo_games").select("opponent").range(from, from + 999);
  if (error) throw error;
  for (const r of data ?? []) names.add(r.opponent as string);
  if (!data || data.length < 1000) break;
}
console.log(`${names.size} players`);
const t0 = Date.now();
const list = [...names];
let total = 0;
for (let i = 0; i < list.length; i += 100) {
  const { fetched } = await refreshPlayers(list.slice(i, i + 100));
  total += fetched;
  console.log(`${Math.min(i + 100, list.length)}/${list.length} checked, ${total} fetched, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
