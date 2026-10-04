import "server-only";
import { z } from "zod";
import { db as getDb } from "@/lib/supabase/admin";
import { T } from "@/lib/supabase/tables";
import { env } from "@/lib/env";
import { knowledgeFor } from "@/lib/knowledge";
import { structuredCall } from "@/lib/coach/claude";
import { COACH_VOICE } from "@/lib/coach/prompts";
import { notationIn } from "@/lib/coach/guard";
import { longSentences, noDashes } from "@/lib/coach/text";
import { computeProfileStats, type ProfileStats } from "./stats";

const item = z.object({ title: z.string(), explanation: z.string(), evidence: z.string(), tag_ids: z.array(z.string()) });
const profileSchema = z.object({
  style: z.object({ title: z.string(), summary: z.array(z.string()) }),
  weaknesses: z.array(item.extend({ fix: z.string(), knowledge_ids: z.array(z.string()) })),
  strengths: z.array(item),
  patterns: z.array(z.object({ insight: z.string(), evidence: z.string() })),
  openings: z.object({ summary: z.string(), keep: z.array(z.string()), fix: z.array(z.string()) }),
  time: z.object({ summary: z.string(), advice: z.string() }),
  mindset: z.object({ summary: z.string(), advice: z.string() }),
  progress: z.object({ summary: z.string() }),
  training_plan: z.array(z.object({ focus: z.string(), why: z.string(), how: z.string(), knowledge_ids: z.array(z.string()) })),
  memory: z.string(),
});
export type WrittenProfile = z.infer<typeof profileSchema>;

const PROFILE_TASK = `Task: build the player's profile from the statistics of every game Nimzo analyzed. This profile is how you, Arthur, understand how he plays. You will carry the "memory" into every future conversation with him, so it must be accurate and specific.

You get: totals, accuracy, errors per game, his problem tags ranked by what they cost him (winning chances lost per game; with how many games they appear in, the rate per game, the trend comparing his last 100 games with earlier ones), his strengths, error rates under different conditions (phase, clock, position, time spent, right after mistakes; "lift" means how many times more likely than his average, and "significant" means the sample is big enough to trust), game level splits (opponent rating, sessions, time of day), openings, conversion of winning positions, how games end, clock habits, Maia (blind spots are mistakes most players at his level would NOT make), the principles he breaks, and knowledge base sections for his biggest patterns.

Rules:
- Every claim must come from the numbers. Put the number in the evidence field ("in 41% of games", "2.3 times more often when winning").
- Only treat a condition as a pattern if it is marked significant.
- Rank weaknesses by how many points they cost him, not by how dramatic they sound. Group related tags into one weakness (for example hanging pieces after captures, losing captures and miscounted exchanges are one habit).
- Be kind and direct. He wants to improve; name the habits plainly.

Write:
- style: a short title for how he plays (3 to 6 words) and 2 short paragraphs describing his chess personality from the data.
- weaknesses: the 3 to 5 habits holding him back most, each with a plain explanation, the evidence, the tag ids it covers, a concrete fix, and the knowledge section ids that teach it.
- strengths: 2 to 4 real strengths with evidence.
- patterns: 4 to 8 insights about WHEN he goes wrong or right (clock, position, session, opponents), each with evidence.
- openings: a summary, what to keep, what to fix.
- time: clock habits summary and one piece of advice.
- mindset: tilt, relaxing when winning, resigning, comebacks: summary and one piece of advice.
- progress: how he has changed over time (monthly numbers and tag trends).
- training_plan: exactly 3 focus areas, most important first: what, why (with a number), how (a concrete routine or drill), knowledge section ids.
- memory: at most 200 words, written to yourself in the third person ("He..."), listing the facts you must remember about his play: top habits with numbers, when they happen, strengths, openings, clock, mindset, current focus. Dense facts, no fluff.

House style: no notation, no square names, no dashes, short sentences.`;

/** Smaller copy of the stats for the prompt (examples and long tails trimmed). */
function compact(s: ProfileStats) {
  const tag = (t: ProfileStats["weaknesses"][number]) => ({ id: t.id, label: t.label, meaning: t.plain, games_pct: t.games_pct, per_game: t.per_game, winning_chances_lost_per_game: t.lost_per_game, avg_lost_when_it_happens: t.avg_lost, recent_per_game: t.recent_per_game, earlier_per_game: t.earlier_per_game, trend: t.trend, source: t.source });
  return {
    ...s,
    weaknesses: s.weaknesses.slice(0, 25).map(tag),
    strengths: s.strengths.slice(0, 10).map(tag),
    conditions: s.conditions.map(({ dimension, bucket, moves, big_error_rate, lift, significant }) => ({ dimension, bucket, moves, big_error_rate, lift, significant })),
    openings: s.openings.slice(0, 12),
  };
}

function problems(p: WrittenProfile): string[] {
  const texts = [
    p.style.title, ...p.style.summary,
    ...p.weaknesses.flatMap((w) => [w.title, w.explanation, w.evidence, w.fix]),
    ...p.strengths.flatMap((w) => [w.title, w.explanation, w.evidence]),
    ...p.patterns.flatMap((x) => [x.insight, x.evidence]),
    p.openings.summary, ...p.openings.keep, ...p.openings.fix,
    p.time.summary, p.time.advice, p.mindset.summary, p.mindset.advice, p.progress.summary,
    ...p.training_plan.flatMap((t) => [t.focus, t.why, t.how]),
  ];
  const out: string[] = [];
  for (const t of texts) {
    const n = notationIn(t);
    if (n.length) out.push(`notation (${n.join(", ")}) in "${t.slice(0, 50)}"`);
    if (longSentences(t, 28).length) out.push(`sentence too long in "${t.slice(0, 50)}"`);
  }
  if (p.training_plan.length !== 3) out.push("training_plan must have exactly 3 items");
  if (p.memory.split(/\s+/).length > 230) out.push("memory is over 200 words");
  return out;
}

/** Deep-applies the house style to every string in the profile. */
function clean<T>(x: T): T {
  if (typeof x === "string") return noDashes(x) as T;
  if (Array.isArray(x)) return x.map(clean) as T;
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k.endsWith("_ids") ? v : clean(v)])) as T;
  return x;
}

/**
 * Rebuilds the player model: fresh statistics from every analyzed game, then
 * Arthur's written profile and memory. Saved as a new version.
 */
export async function rebuildProfile(timeClass = "rapid"): Promise<{ id: string; games: number }> {
  const stats = await computeProfileStats(timeClass);
  const topTags = stats.weaknesses.slice(0, 10).map((t) => t.id);
  const knowledge = knowledgeFor({ tags: topTags, budget: 9000 });
  const input = { stats: compact(stats), knowledge: knowledge.text };
  const system = `${COACH_VOICE}\n\n${PROFILE_TASK}`;
  let user = JSON.stringify(input);
  let profile: WrittenProfile | null = null;
  let model = env().CLAUDE_MODEL_COACH;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await structuredCall({ model: env().CLAUDE_MODEL_COACH, system, user, schema: profileSchema, effort: "high", maxTokens: 16000 });
    profile = clean(res.data);
    model = res.model;
    const bad = problems(profile);
    if (!bad.length) break;
    if (attempt === 0) user = `${JSON.stringify(input)}\n\nRewrite: ${bad.slice(0, 15).join("; ")}.`;
  }
  const db = await getDb();
  const { data, error } = await db
    .from(T.player_profiles)
    .insert({ time_class: timeClass, games_analyzed: stats.games, period_from: stats.period.from, period_to: stats.period.to, stats, profile, memory: profile?.memory ?? null, model })
    .select("id")
    .single();
  if (error) throw new Error(`save profile: ${error.message}`);
  return { id: data.id, games: stats.games };
}
