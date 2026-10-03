import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { KNOWLEDGE_BUCKET } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { logError } from "@/lib/log";

export const maxDuration = 60;

const body = z.object({ text: z.string().min(1).max(1500) });

/**
 * Coach voice. Each distinct text is synthesized once with ElevenLabs and cached
 * in private Supabase Storage (keyed by voice + model + text), so replays cost
 * no ElevenLabs characters.
 */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const e = env();
  if (!e.ELEVENLABS_API_KEY) return NextResponse.json({ error: "ELEVENLABS_API_KEY is not set" }, { status: 503 });

  const text = parsed.data.text.trim();
  const key = createHash("sha256").update(`${e.ELEVENLABS_VOICE_ID}|${e.ELEVENLABS_MODEL}|${text}`).digest("hex");
  const path = `audio/${key}.mp3`;
  const db = await getDb();

  const cached = await db.storage.from(KNOWLEDGE_BUCKET).download(path);
  if (cached.data) return audio(await cached.data.arrayBuffer(), true);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${e.ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": e.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: e.ELEVENLABS_MODEL }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    await logError("tts", new Error(`ElevenLabs ${res.status}`), { detail });
    const message = res.status === 401 ? "ElevenLabs key rejected" : res.status === 402 ? "ElevenLabs plan doesn't allow this voice" : res.status === 429 ? "ElevenLabs quota reached" : "Voice unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  const bytes = await res.arrayBuffer();
  await db.storage.from(KNOWLEDGE_BUCKET).upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
  return audio(bytes, false);
}

function audio(bytes: ArrayBuffer, cached: boolean) {
  return new NextResponse(bytes, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=31536000, immutable", "X-Nimzo-Cache": cached ? "hit" : "miss" },
  });
}
