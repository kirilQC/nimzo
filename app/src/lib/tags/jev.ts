import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import type { MoveFeatures } from "@/lib/analysis/features";
import { isSeverity } from "@/lib/analysis/math";
import { INTENTS, JEV_CRITERIA, JEV_TAGS, KB_CATEGORIES, PRINCIPLES, ROOT_CAUSES_V2, type TagDef } from "./catalog";
import { factSheet, type MaiaFact } from "./factsheet";

/**
 * Jev (TypeSafe's System One model) through OpenRouter's Decisions API, v2.
 *
 * Jev gets a plain-English fact sheet built by code (it never has to work out
 * chess from notation) and answers only judgment questions: why the move was
 * played, the reason for a mistake, and yes/no for each judgment tag that fits
 * the moment (phase, good or bad move). Tags that code can decide for certain
 * are never asked. Criteria and the category/principle questions come from the
 * knowledge base (lib/knowledge), so Jev judges by the rules Arthur teaches.
 */
const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";

const choiceAnswer = z.object({ type: z.literal("choice"), choice: z.string(), confidence: z.number().optional(), probabilities: z.record(z.string(), z.number()).optional() });
const noulAnswer = z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) });
const responseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), z.union([choiceAnswer, noulAnswer])),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number(), cost: z.number().optional() }).optional(),
});

export type JevResult = {
  tags: Record<string, number>; // tag id -> probability it applies
  intent: { value: string; confidence: number | null } | null;
  root_cause: { value: string; confidence: number | null } | null;
  category: { value: string; confidence: number | null } | null; // knowledge base 1.2 category
  principle: { value: string; confidence: number | null } | null; // knowledge base principle broken
  usage: { cost: number | null; input_tokens: number; output_tokens: number } | null;
  model: string;
};

/**
 * Board-fact preconditions for judgment tags. Graded against Opus on 60 of the
 * player's mistakes (scripts/calibrate-jev.mts), Jev over-applied these when asked blindly;
 * asking only when the facts make the tag possible removes most false yeses.
 */
const GATES: Record<string, (f: MoveFeatures) => boolean> = {
  relaxed_when_winning: (f) => f.win_before >= 65,
  failed_conversion: (f) => f.win_before >= 70,
  missed_simplification: (f) => f.material.before >= 2,
  good_simplification: (f) => f.material.before >= 2,
  pawn_grab_greed: (f) => f.played?.captures === "pawn",
  miscounted_exchange: (f) => !!f.played?.captures,
  assumed_forced_recapture: (f) => !!f.played?.captures,
  missed_zwischenzug: (f) => !f.played_best && !!(f.best.pattern?.check || f.best.pattern?.captures),
  missed_counterattack: (f) => !f.played_best && f.threats_before.length > 0 && !!(f.best.pattern?.check || f.best.pattern?.attacks_queen || f.best.pattern?.captures),
  removed_own_defender: (f) => f.hanging_after.some((h) => h.square !== f.uci.slice(2, 4)),
  overloaded_own_defender: (f) => f.hanging_after.length > 0,
  panic_defense: (f) => f.win_before <= 45,
  trusted_opponent_threat: (f) => !f.played_best && f.threats_before.length === 0,
  premature_attack: (f) => f.development.mine_after <= 2 || !f.king.castled_after,
  premature_attack_opening: (f) => f.development.mine_after <= 2,
  passive_king_endgame: (f) => f.piece !== "king",
  active_king_endgame: (f) => f.piece === "king",
  seized_open_file: (f) => f.piece === "rook",
  rook_inactive: (f) => f.piece !== "rook",
  neglected_king_safety: (f) => !f.king.castled_after || f.king.zone_attackers_after >= 2,
};

/** Which judgment tags to ask about for this move. */
export function questionsFor(f: MoveFeatures): TagDef[] {
  const flagged = isSeverity(f.label);
  const goodMove = !flagged && ["brilliant", "great", "best", "excellent", "good"].includes(f.label ?? "");
  return JEV_TAGS.filter((t) => {
    if (GATES[t.id] && !GATES[t.id]!(f)) return false;
    const on = t.ask?.on ?? (t.polarity === "good" ? "good" : "flagged");
    if (on === "flagged" && !flagged) return false;
    if (on === "good" && !goodMove) return false;
    if (t.ask?.phases && !t.ask.phases.includes(f.phase)) return false;
    return true;
  });
}

export function buildRequest(f: MoveFeatures, maia: MaiaFact) {
  const flagged = isSeverity(f.label);
  const questions: Record<string, unknown> = {
    intent: {
      type: "choice",
      instructions: "What was the player most likely trying to do with this move? Judge from the facts about the move and the position.",
      criteria: Object.fromEntries(INTENTS.map((i) => [i.id, i.description])),
    },
  };
  if (flagged)
    questions.root_cause = {
      type: "choice",
      instructions:
        "Why did the player most likely make this mistake? Use the threats before the move, the opponent's best answer, the clock, and how common the move is among similar players. Choose 'unclear' if the facts don't point to one cause.",
      criteria: Object.fromEntries(ROOT_CAUSES_V2.map((r) => [r.id, r.description])),
    };
  if (flagged) {
    questions.category = {
      type: "choice",
      instructions: "Which kind of mistake is this, using a coach's six categories? Pick the one that best explains why it lost ground.",
      criteria: Object.fromEntries(KB_CATEGORIES.map((c) => [c.id, c.description])),
    };
    questions.principle = {
      type: "choice",
      instructions: "Which coaching principle, had the player followed it, would most likely have prevented this mistake?",
      criteria: Object.fromEntries(PRINCIPLES.map((p) => [p.id, p.description])),
    };
  }
  for (const t of questionsFor(f)) {
    questions[`tag_${t.id}`] = {
      type: "noul",
      instructions: `Does this describe the move? "${t.label}": ${JEV_CRITERIA[t.id] ?? t.criteria ?? t.plain} Answer only from the facts given; if the facts don't show it, answer no.`,
      criteria: { true: `Yes: ${JEV_CRITERIA[t.id] ?? t.criteria ?? t.plain}`, false: "No, or the facts don't show it." },
    };
  }
  const state = { player_move: f.san, facts: factSheet(f, maia) };
  return { state, questions };
}

export async function jevClassify(f: MoveFeatures, maia: MaiaFact): Promise<JevResult> {
  const key = env().OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const { state, questions } = buildRequest(f, maia);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: env().JEV_MODEL, state, questions }),
        signal: AbortSignal.timeout(45_000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`Jev ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`), { fatal: true });
      const parsed = responseSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error(`Unexpected Jev response: ${parsed.error.issues[0]?.message}`);
      return toResult(parsed.data);
    } catch (e) {
      lastErr = e;
      if ((e as { fatal?: boolean }).fatal) break;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}

function toResult(d: z.infer<typeof responseSchema>): JevResult {
  const tags: Record<string, number> = {};
  for (const [k, v] of Object.entries(d.answers)) if (k.startsWith("tag_") && v.type === "noul") tags[k.slice(4)] = Math.round(v.noul * 1000) / 1000;
  const choice = (a: unknown, allowed: readonly { id: string }[]) => {
    const c = choiceAnswer.safeParse(a);
    if (!c.success || !allowed.some((x) => x.id === c.data.choice)) return null;
    return { value: c.data.choice, confidence: c.data.confidence ?? c.data.probabilities?.[c.data.choice] ?? null };
  };
  return {
    tags,
    intent: choice(d.answers.intent, INTENTS),
    root_cause: choice(d.answers.root_cause, ROOT_CAUSES_V2),
    category: choice(d.answers.category, KB_CATEGORIES),
    principle: choice(d.answers.principle, PRINCIPLES),
    usage: d.usage ? { cost: d.usage.cost ?? null, input_tokens: d.usage.input_tokens, output_tokens: d.usage.output_tokens } : null,
    model: d.model,
  };
}

/** A yes/no tag counts when Jev is at least this sure. */
export const JEV_MIN_PROBABILITY = 0.8;
