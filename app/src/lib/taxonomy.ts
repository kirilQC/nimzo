/**
 * The shared mistake taxonomy: the single source of truth for Nimzo.
 *
 * The same IDs tag my mistakes (Analyze), lesson chunks and puzzles (Learn),
 * so Learn can always point at the lesson for the exact mistake I keep making.
 * The database copy (public.taxonomy_tags) is generated from this file with
 * `npm run gen:taxonomy`; a unit test keeps the two in sync.
 */

import { ROOT_CAUSES_V2, TAGS as CATALOG } from "./tags/catalog";

export type TagDef = { id: string; label: string; description: string };

function defs<const T extends readonly TagDef[]>(list: T) {
  return list;
}

export const MISTAKE_TYPES = defs([
  { id: "tactical", label: "Tactical", description: "A concrete tactic was missed or allowed." },
  { id: "positional", label: "Positional", description: "A long-term concession: structure, piece placement, or plan." },
  { id: "opening", label: "Opening", description: "Went wrong in the opening: theory, development, or principles." },
  { id: "endgame_technique", label: "Endgame technique", description: "Mishandled a simplified position." },
  { id: "time_management", label: "Time management", description: "The clock, not the position, caused the error." },
] as const);

export const PHASES = defs([
  { id: "opening", label: "Opening", description: "Roughly the first 10–12 moves, before development is complete." },
  { id: "middlegame", label: "Middlegame", description: "Pieces developed, most material still on the board." },
  { id: "endgame", label: "Endgame", description: "Queens off or little material left." },
] as const);

/** Why a mistake happened (Jev picks one per flagged move). */
export const ROOT_CAUSES: readonly TagDef[] = ROOT_CAUSES_V2.map((r) => ({ id: r.id, label: r.label, description: r.description }));

/** Every move tag (rule and Jev) from the catalog in lib/tags/catalog.ts. */
export const MOTIFS: readonly TagDef[] = CATALOG.map((t) => ({ id: t.id, label: t.label, description: t.plain }));

export const LEVELS = defs([
  { id: "beginner", label: "Beginner", description: "Fundamentals." },
  { id: "intermediate", label: "Intermediate", description: "Club-level ideas." },
  { id: "advanced", label: "Advanced", description: "Deeper strategy and calculation." },
] as const);

export type MistakeType = (typeof MISTAKE_TYPES)[number]["id"];
export type Phase = (typeof PHASES)[number]["id"];
export type RootCause = (typeof ROOT_CAUSES_V2)[number]["id"];
export type Motif = string;
export type Level = (typeof LEVELS)[number]["id"];

export const DIMENSIONS = {
  mistake_type: MISTAKE_TYPES,
  phase: PHASES,
  root_cause: ROOT_CAUSES,
  motif: MOTIFS,
  level: LEVELS,
} as const;
export type Dimension = keyof typeof DIMENSIONS;

export const LESSON_CATEGORIES = [
  { id: "openings", label: "Openings", description: "Your repertoire, move by move" },
  { id: "tactics", label: "Tactics", description: "Forks, pins, skewers, discoveries" },
  { id: "middlegame_plans", label: "Middlegame plans", description: "What to do when the opening ends" },
  { id: "endgames", label: "Endgames", description: "Must-know positions and technique" },
  { id: "common_blunders", label: "Common blunders", description: "The traps players at your level fall for" },
  { id: "beginner_principles", label: "Beginner principles", description: "Development, king safety, the center" },
] as const;
export type LessonCategory = (typeof LESSON_CATEGORIES)[number]["id"];

const motifIndex = new Map<string, TagDef>(MOTIFS.map((m) => [m.id, m]));
// Older analyses used a few motif ids that the catalog renamed; keep their labels readable.
const LEGACY: Record<string, string> = {
  hanging_piece: "Hanging piece",
  hanging_piece_after_capture: "Hanging piece after a capture",
  king_safety: "King safety",
  pawn_structure: "Pawn structure",
  piece_activity: "Piece activity",
  passive_play: "Passive play",
  opening_principles: "Opening principles",
  endgame_conversion: "Endgame conversion",
  bad_trade: "Bad trade",
  overloaded_defender: "Overloaded defender",
  removal_of_defender: "Removal of the defender",
  discovered_attack: "Discovered attack",
  skewer: "Skewer",
  back_rank: "Back-rank weakness",
};

export function isMotif(id: string): id is Motif {
  return motifIndex.has(id);
}

export function motifLabel(id: string): string {
  return motifIndex.get(id)?.label ?? LEGACY[id] ?? id;
}

export function tagLabel(dimension: Dimension, id: string): string {
  const found = (DIMENSIONS[dimension] as readonly TagDef[]).find((t) => t.id === id);
  return found?.label ?? id;
}

/** Flattened rows for seeding public.taxonomy_tags. Phase IDs collide with
 *  mistake_type "opening", so DB ids are namespaced: `${dimension}:${id}`. */
export function taxonomyRows() {
  return (Object.entries(DIMENSIONS) as [Dimension, readonly TagDef[]][]).flatMap(([dimension, list]) =>
    list.map((t, i) => ({ id: `${dimension}:${t.id}`, dimension, label: t.label, description: t.description, sort_order: i })),
  );
}
