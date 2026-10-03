import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { MISTAKE_TYPES, MOTIFS, PHASES, ROOT_CAUSES, type MistakeType, type Motif, type Phase, type RootCause } from "@/lib/taxonomy";
import { classifierState } from "./state";
import type { Classifier, ClassifyInput, TagResult } from "./types";

/**
 * Jev (TypeSafe's System One model) via OpenRouter's Decisions API.
 * Many small, independent questions: one choice per single-label field and one
 * yes/no ("noul") question per motif, as TypeSafe recommends.
 */
const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";

const choiceAnswer = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  confidence: z.number().optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
});
const noulAnswer = z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) });
const responseSchema = z.object({
  model: z.string(),
  answers: z.record(z.string(), z.union([choiceAnswer, noulAnswer])),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number(), cost: z.number().optional() }).optional(),
});

function criteria(list: readonly { id: string; description: string }[]) {
  return Object.fromEntries(list.map((t) => [t.id, t.description]));
}

export function jevQuestions() {
  const q: Record<string, unknown> = {
    mistake_type: {
      type: "choice",
      instructions: "What kind of mistake is this move, judged only from the engine facts provided?",
      criteria: criteria(MISTAKE_TYPES),
    },
    phase: { type: "choice", instructions: "Which phase of the game was this move played in?", criteria: criteria(PHASES) },
    root_cause: {
      type: "choice",
      instructions:
        "What most likely caused the player to make this move? Use the clock, the evaluation before the move, the opponent's previous move and the human-likeness data. Choose 'unclear' if the facts do not support a cause.",
      criteria: criteria(ROOT_CAUSES),
    },
  };
  for (const m of MOTIFS) {
    q[`motif_${m.id}`] = {
      type: "noul",
      instructions: `Is "${m.label}" part of what went wrong with this move? ${m.description}`,
      criteria: {
        true: `The facts show this: ${m.description}`,
        false: "The facts do not show this pattern.",
      },
    };
  }
  return q;
}

export class JevClassifier implements Classifier {
  readonly name = "jev" as const;

  async classify(input: ClassifyInput): Promise<TagResult> {
    const key = env().OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is not set");
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env().JEV_MODEL, state: classifierState(input), questions: jevQuestions() }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const parsed = responseSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error(`Unexpected Jev response: ${parsed.error.issues[0]?.message}`);
    return toTags(parsed.data.answers, parsed.data);
  }
}

function choice<T extends string>(a: unknown, allowed: readonly { id: string }[], fallback: T) {
  const c = choiceAnswer.safeParse(a);
  if (!c.success || !allowed.some((t) => t.id === c.data.choice)) return { value: fallback, confidence: 0, source: "jev" as const };
  const conf = c.data.confidence ?? c.data.probabilities?.[c.data.choice] ?? null;
  return { value: c.data.choice as T, confidence: conf, source: "jev" as const };
}

function toTags(answers: Record<string, unknown>, raw: unknown): TagResult {
  const motifs: TagResult["motifs"] = {};
  for (const m of MOTIFS) {
    const a = noulAnswer.safeParse(answers[`motif_${m.id}`]);
    if (!a.success) continue;
    const p = a.data.noul;
    // A yes/no answer is a single probability; confidence is how far it sits from a coin flip.
    motifs[m.id as Motif] = { value: p >= 0.5, confidence: Math.max(p, 1 - p), source: "jev" };
  }
  return {
    mistake_type: choice<MistakeType>(answers.mistake_type, MISTAKE_TYPES, "tactical"),
    phase: choice<Phase>(answers.phase, PHASES, "middlegame"),
    root_cause: choice<RootCause>(answers.root_cause, ROOT_CAUSES, "unclear"),
    motifs,
    raw,
  };
}
