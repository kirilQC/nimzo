/**
 * The shared mistake taxonomy: the single source of truth for Nimzo.
 *
 * The same IDs tag my mistakes (Analyze), lesson chunks and puzzles (Learn),
 * so Learn can always point at the lesson for the exact mistake I keep making.
 * The database copy (public.taxonomy_tags) is generated from this file with
 * `npm run gen:taxonomy`; a unit test keeps the two in sync.
 */

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

export const ROOT_CAUSES = defs([
  { id: "time_pressure", label: "Time pressure", description: "Little time on the clock forced a rushed move." },
  { id: "missed_opponent_threat", label: "Missed opponent's threat", description: "Didn't ask what the opponent's last move was threatening." },
  { id: "calculation_error", label: "Calculation error", description: "Saw the idea but calculated the line wrong." },
  { id: "tunnel_vision", label: "Tunnel vision", description: "Focused on one plan and stopped checking the rest of the board." },
  { id: "relaxed_when_winning", label: "Relaxed when winning", description: "Let up after getting a good position." },
  { id: "unfamiliar_position", label: "Unfamiliar position", description: "Didn't know the typical plans or patterns here." },
  { id: "unclear", label: "Unclear", description: "The data doesn't support a confident cause." },
] as const);

export const MOTIFS = defs([
  { id: "hanging_piece", label: "Hanging piece", description: "Left a piece attacked and undefended." },
  { id: "hanging_piece_after_capture", label: "Hanging piece after a capture", description: "Left a piece hanging right after a capture or recapture." },
  { id: "missed_fork", label: "Missed fork", description: "A fork was available and wasn't played." },
  { id: "allowed_fork", label: "Allowed fork", description: "Let the opponent fork two or more pieces." },
  { id: "missed_pin", label: "Missed pin", description: "A pin was available and wasn't used." },
  { id: "allowed_pin", label: "Allowed pin", description: "Walked into a pin." },
  { id: "skewer", label: "Skewer", description: "A skewer was missed or allowed." },
  { id: "discovered_attack", label: "Discovered attack", description: "A discovered attack was missed or allowed." },
  { id: "back_rank", label: "Back-rank weakness", description: "The back rank was weak and it cost material or the game." },
  { id: "missed_mate", label: "Missed mate", description: "A forced mate was available and wasn't played." },
  { id: "allowed_mate_threat", label: "Allowed mate threat", description: "Let the opponent create a mating threat." },
  { id: "overloaded_defender", label: "Overloaded defender", description: "A defender had too many jobs." },
  { id: "removal_of_defender", label: "Removal of the defender", description: "A key defender was captured or deflected." },
  { id: "trapped_piece", label: "Trapped piece", description: "A piece ran out of safe squares." },
  { id: "bad_trade", label: "Bad trade", description: "Traded into a worse position or gave up a key piece." },
  { id: "king_safety", label: "King safety", description: "Weakened or neglected the king's shelter." },
  { id: "pawn_structure", label: "Pawn structure", description: "Created lasting pawn weaknesses." },
  { id: "piece_activity", label: "Piece activity", description: "Pieces left passive or poorly placed." },
  { id: "passive_play", label: "Passive play", description: "Missed a chance to act and drifted." },
  { id: "premature_attack", label: "Premature attack", description: "Attacked before the position was ready." },
  { id: "opening_principles", label: "Opening principles", description: "Broke basic opening principles: development, center, castling." },
  { id: "endgame_conversion", label: "Endgame conversion", description: "Failed to convert a winning endgame." },
] as const);

export const LEVELS = defs([
  { id: "beginner", label: "Beginner", description: "Fundamentals." },
  { id: "intermediate", label: "Intermediate", description: "Club-level ideas." },
  { id: "advanced", label: "Advanced", description: "Deeper strategy and calculation." },
] as const);

export type MistakeType = (typeof MISTAKE_TYPES)[number]["id"];
export type Phase = (typeof PHASES)[number]["id"];
export type RootCause = (typeof ROOT_CAUSES)[number]["id"];
export type Motif = (typeof MOTIFS)[number]["id"];
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

export function isMotif(id: string): id is Motif {
  return motifIndex.has(id);
}

export function motifLabel(id: string): string {
  return motifIndex.get(id)?.label ?? id;
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
