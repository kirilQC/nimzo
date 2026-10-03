import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";
import { MISTAKE_TYPES, MOTIFS, PHASES, ROOT_CAUSES, type Motif } from "@/lib/taxonomy";
import { classifierState } from "./state";
import type { Classifier, ClassifyInput, TagResult } from "./types";

/** Fallback classifier when Jev errors: Claude with a strict JSON schema. Marked source "fallback". */

const ids = <T extends readonly { id: string }[]>(l: T) => l.map((t) => t.id) as [string, ...string[]];

const schema = z.object({
  mistake_type: z.enum(ids(MISTAKE_TYPES)),
  mistake_type_confidence: z.number(),
  phase: z.enum(ids(PHASES)),
  phase_confidence: z.number(),
  root_cause: z.enum(ids(ROOT_CAUSES)),
  root_cause_confidence: z.number(),
  motifs: z.array(z.object({ id: z.enum(ids(MOTIFS)), present: z.boolean(), confidence: z.number() })),
});

const SYSTEM = `You classify one chess mistake into a fixed taxonomy for a coaching app.
Use only the facts provided. They come from a chess engine and deterministic code. Do not calculate chess yourself and do not assume any move or variation that is not in the data.
Confidence is a number from 0 to 1. Use low confidence when the facts do not clearly support a label.

Taxonomy:
mistake_type: ${MISTAKE_TYPES.map((t) => `${t.id} (${t.description})`).join("; ")}
phase: ${PHASES.map((t) => `${t.id} (${t.description})`).join("; ")}
root_cause: ${ROOT_CAUSES.map((t) => `${t.id} (${t.description})`).join("; ")}
motifs (answer every one): ${MOTIFS.map((t) => `${t.id} (${t.description})`).join("; ")}`;

export class ClaudeClassifier implements Classifier {
  readonly name = "fallback" as const;

  async classify(input: ClassifyInput): Promise<TagResult> {
    const client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
    const response = await client.messages.parse({
      model: env().CLAUDE_MODEL_REVIEW,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: JSON.stringify(classifierState(input)) }],
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined to classify");
    const out = response.parsed_output;
    if (!out) throw new Error("Claude returned no parseable classification");
    const clamp = (x: number) => Math.max(0, Math.min(1, x));
    const motifs: TagResult["motifs"] = {};
    for (const m of out.motifs) motifs[m.id as Motif] = { value: m.present, confidence: clamp(m.confidence), source: "fallback" };
    return {
      mistake_type: { value: out.mistake_type as TagResult["mistake_type"]["value"], confidence: clamp(out.mistake_type_confidence), source: "fallback" },
      phase: { value: out.phase as TagResult["phase"]["value"], confidence: clamp(out.phase_confidence), source: "fallback" },
      root_cause: { value: out.root_cause as TagResult["root_cause"]["value"], confidence: clamp(out.root_cause_confidence), source: "fallback" },
      motifs,
      raw: out,
    };
  }
}
