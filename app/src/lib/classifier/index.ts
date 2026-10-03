import "server-only";
import { logError } from "@/lib/log";
import { MOTIFS, type Motif } from "@/lib/taxonomy";
import type { Detectors } from "@/lib/analysis/facts";
import { ClaudeClassifier } from "./claude";
import { JevClassifier } from "./jev";
import type { ClassifyInput, TagResult } from "./types";

export type { TagResult } from "./types";

/** Detector -> motif. A detector that fires always wins over the classifier. */
const DETECTOR_MOTIF: Partial<Record<keyof Detectors, Motif>> = {
  hanging_piece: "hanging_piece",
  hanging_piece_after_capture: "hanging_piece_after_capture",
  allowed_fork: "allowed_fork",
  missed_fork: "missed_fork",
  back_rank: "back_rank",
  missed_mate: "missed_mate",
  allowed_mate_threat: "allowed_mate_threat",
};

/** Detectors that are certain in both directions, so a negative also overrides the classifier. */
const CERTAIN_NEGATIVE = new Set<keyof Detectors>(["missed_mate"]);

/**
 * Classifies one mistake: Jev first, Claude as a fallback if Jev errors.
 * Deterministic detectors and the deterministic phase win when they disagree;
 * the classifier's original answers are kept in `overridden` for debugging.
 */
export async function classifyMistake(input: ClassifyInput, gameId?: string): Promise<TagResult & { overridden: Record<string, unknown> }> {
  let result: TagResult;
  try {
    result = await new JevClassifier().classify(input);
  } catch (e) {
    await logError("jev", e, { ply: input.facts.ply }, gameId);
    result = await new ClaudeClassifier().classify(input);
  }
  return applyDetectors(result, input);
}

export function applyDetectors(result: TagResult, input: ClassifyInput): TagResult & { overridden: Record<string, unknown> } {
  const overridden: Record<string, unknown> = {};
  const motifs = { ...result.motifs };
  for (const [det, motif] of Object.entries(DETECTOR_MOTIF) as [keyof Detectors, Motif][]) {
    const fired = input.facts.detectors[det];
    const current = motifs[motif];
    if (fired && current?.value !== true) {
      overridden[motif] = current ?? null;
      motifs[motif] = { value: true, confidence: 1, source: "detector" };
    } else if (!fired && CERTAIN_NEGATIVE.has(det) && current?.value === true) {
      overridden[motif] = current;
      motifs[motif] = { value: false, confidence: 1, source: "detector" };
    } else if (fired) {
      motifs[motif] = { value: true, confidence: 1, source: "detector" };
    }
  }
  let phase = result.phase;
  if (phase.value !== input.facts.phase) {
    overridden.phase = phase;
    phase = { value: input.facts.phase, confidence: 1, source: "detector" };
  }
  return { ...result, phase, motifs, overridden };
}

/** Motifs confident enough to count in pattern statistics. */
export function confidentMotifs(tags: TagResult, minConfidence: number): Motif[] {
  return MOTIFS.map((m) => m.id as Motif).filter((id) => {
    const t = tags.motifs[id];
    return t?.value === true && (t.confidence ?? 0) >= minConfidence;
  });
}
