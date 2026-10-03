import type { MistakeType, Motif, Phase, RootCause } from "@/lib/taxonomy";
import type { MoveFacts } from "@/lib/analysis/facts";

export type TagSource = "jev" | "fallback" | "detector";

export type Tag<T> = { value: T; confidence: number | null; source: TagSource };

export type TagResult = {
  mistake_type: Tag<MistakeType>;
  phase: Tag<Phase>;
  root_cause: Tag<RootCause>;
  motifs: Partial<Record<Motif, Tag<boolean>>>;
  raw?: unknown; // provider response, kept for debugging
};

export type MaiaInfo = { elo: number; p_played: number; p_best: number | null; model: string } | null;

export type ClassifyInput = { facts: MoveFacts; maia: MaiaInfo };

/** Swappable classification provider (Jev today, anything else tomorrow). */
export interface Classifier {
  readonly name: TagSource;
  classify(input: ClassifyInput): Promise<TagResult>;
}
