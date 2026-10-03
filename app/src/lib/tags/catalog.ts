/**
 * Nimzo's move-tag catalog: every pattern a move can be tagged with.
 *
 * - `rule` tags are computed from board facts (lib/analysis/features.ts) and are
 *   certain. Jev is never asked about them.
 * - `jev` tags need judgment (why a move was played, plans, thinking habits).
 *   Jev answers yes/no from a plain-English fact sheet; `ask` limits when the
 *   question is asked (phase and whether the move was good or bad), so Jev is
 *   never asked about an endgame idea in the opening.
 *
 * `plain` is the beginner-friendly meaning; Arthur and the UI use it.
 */

export type TagGroup =
  | "blunder" // material dropped or a tactic allowed
  | "missed" // a tactic or win not taken
  | "found" // good tactical finds
  | "opening"
  | "king"
  | "structure"
  | "trade"
  | "clock"
  | "context" // the state of the game around the move
  | "strategy"
  | "endgame"
  | "thinking" // thought-process habits
  | "good"; // good habits

export type Polarity = "bad" | "good" | "neutral";
type Phase = "opening" | "middlegame" | "endgame";

export type TagDef = {
  id: string;
  group: TagGroup;
  label: string;
  plain: string;
  source: "rule" | "jev";
  polarity: Polarity;
  /** jev tags: when to ask. Defaults: any phase; bad tags on flagged moves, good tags on good moves. */
  ask?: { phases?: Phase[]; on?: "flagged" | "good" | "any" };
  /** jev tags: what "yes" means, for the question. Defaults to `plain`. */
  criteria?: string;
};

const r = (group: TagGroup, polarity: Polarity, id: string, label: string, plain: string): TagDef => ({ id, group, label, plain, source: "rule", polarity });
const j = (group: TagGroup, polarity: Polarity, id: string, label: string, plain: string, extra: Partial<TagDef> = {}): TagDef => ({ id, group, label, plain, source: "jev", polarity, ...extra });

const O: Phase[] = ["opening"];
const M: Phase[] = ["middlegame"];
const E: Phase[] = ["endgame"];
const OM: Phase[] = ["opening", "middlegame"];
const ME: Phase[] = ["middlegame", "endgame"];

export const TAGS: TagDef[] = [
  // ---- Blunder mechanics (rule) ----------------------------------------------
  r("blunder", "bad", "hung_queen", "Hung the queen", "You left your queen where it could be taken."),
  r("blunder", "bad", "hung_rook", "Hung a rook", "You left a rook where it could be taken for free or for less."),
  r("blunder", "bad", "hung_minor", "Hung a knight or bishop", "You left a knight or bishop unprotected and it could be taken."),
  r("blunder", "bad", "hung_pawn", "Dropped a pawn", "You let a pawn be taken for nothing."),
  r("blunder", "bad", "hung_moved_piece", "Moved a piece to an unsafe square", "The piece you just moved can be taken right away."),
  r("blunder", "bad", "unprotected_other_piece", "Left another piece unprotected", "Your move stopped protecting one of your other pieces."),
  r("blunder", "bad", "hanging_after_capture", "Hung a piece right after a capture", "In the middle of trading pieces, you left something hanging."),
  r("blunder", "bad", "ignored_threat", "Ignored a threat", "Your opponent was attacking one of your pieces and you didn't deal with it."),
  r("blunder", "bad", "allowed_fork", "Walked into a fork", "You let your opponent attack two of your pieces at once."),
  r("blunder", "bad", "allowed_knight_fork", "Walked into a knight fork", "You let a knight jump in and attack two of your pieces at once."),
  r("blunder", "bad", "allowed_pin", "Walked into a pin", "You let your opponent pin one of your pieces so it can't move safely."),
  r("blunder", "bad", "allowed_skewer", "Walked into a skewer", "You lined up a valuable piece in front of another one and got skewered."),
  r("blunder", "bad", "allowed_discovered_attack", "Allowed a discovered attack", "You let your opponent move one piece to reveal an attack from another."),
  r("blunder", "bad", "allowed_mate", "Allowed checkmate", "After your move, your opponent had a forced checkmate."),
  r("blunder", "bad", "allowed_mate_threat", "Allowed a mating attack", "Your move let your opponent start a mating attack."),
  r("blunder", "bad", "allowed_trapped_piece", "Let a piece get trapped", "Your opponent could trap one of your pieces so it had nowhere to go."),
  r("blunder", "bad", "allowed_promotion", "Let a pawn promote", "You let your opponent's pawn reach the end and become a queen."),
  r("blunder", "bad", "losing_capture", "Captured into a loss", "You took something, but lost more than you won when they took back."),
  r("blunder", "bad", "bad_exchange", "Gave up a stronger piece for a weaker one", "You traded a more valuable piece for a less valuable one."),
  r("blunder", "bad", "moved_pinned_piece_line", "Broke a pin badly", "You moved a pinned piece and exposed something more valuable behind it."),
  r("blunder", "bad", "stalemated_opponent", "Stalemated a winning game", "You were winning but left your opponent with no legal moves: a draw."),
  r("blunder", "bad", "back_rank_weakness", "Back-rank weakness", "Your king was stuck on the back row with no escape square."),

  // ---- Missed chances (rule) -------------------------------------------------
  r("missed", "bad", "missed_free_piece", "Missed a free piece", "Your opponent left a piece hanging and you didn't take it."),
  r("missed", "bad", "missed_free_pawn", "Missed a free pawn", "There was a free pawn to take and you didn't take it."),
  r("missed", "bad", "missed_mate", "Missed checkmate", "You had a forced checkmate and didn't play it."),
  r("missed", "bad", "missed_mate_in_one", "Missed mate in one", "You could have checkmated in one move."),
  r("missed", "bad", "missed_fork", "Missed a fork", "You could have attacked two pieces at once."),
  r("missed", "bad", "missed_pin", "Missed a pin", "You could have pinned one of their pieces."),
  r("missed", "bad", "missed_skewer", "Missed a skewer", "You could have attacked a valuable piece and won the one behind it."),
  r("missed", "bad", "missed_discovered_attack", "Missed a discovered attack", "You could have moved one piece to reveal an attack from another."),
  r("missed", "bad", "missed_winning_check", "Missed a winning check", "A check would have won material or the game."),
  r("missed", "bad", "missed_trap", "Missed trapping a piece", "You could have trapped one of their pieces."),
  r("missed", "bad", "missed_promotion", "Missed promoting", "You could have pushed a pawn to the end and made a queen."),
  r("missed", "bad", "missed_punishment", "Didn't punish their mistake", "Your opponent had just made a mistake and you didn't take advantage."),
  r("missed", "bad", "missed_material_win", "Missed winning material", "There was a way to win material and you played something else."),
  r("missed", "bad", "missed_queen_attack", "Missed attacking the queen", "You could have attacked their queen and gained time."),

  // ---- Tactics found (rule) ----------------------------------------------------
  r("found", "good", "found_fork", "Found a fork", "You attacked two pieces at once."),
  r("found", "good", "found_pin", "Found a pin", "You pinned one of their pieces."),
  r("found", "good", "found_skewer", "Found a skewer", "You skewered their pieces."),
  r("found", "good", "found_discovered_attack", "Found a discovered attack", "You uncovered an attack from another piece."),
  r("found", "good", "found_mate", "Delivered checkmate", "You checkmated your opponent."),
  r("found", "good", "won_free_piece", "Took a free piece", "You took a piece your opponent left hanging."),
  r("found", "good", "trapped_piece", "Trapped a piece", "You trapped one of their pieces."),
  r("found", "good", "punished_mistake", "Punished their mistake", "Your opponent slipped and you made them pay."),
  r("found", "good", "sound_sacrifice", "Sound sacrifice", "You gave up material on purpose and it worked."),
  r("found", "good", "promoted", "Promoted a pawn", "You turned a pawn into a new queen."),

  // ---- Opening (rule) -----------------------------------------------------------
  r("opening", "bad", "early_queen", "Brought the queen out early", "You moved your queen out before your other pieces were ready."),
  r("opening", "bad", "same_piece_twice", "Moved the same piece twice", "You moved one piece again in the opening instead of developing a new one."),
  r("opening", "bad", "slow_development", "Slow development", "Most of your knights and bishops were still at home."),
  r("opening", "bad", "not_castled", "King still in the middle", "Your king was still in the middle of the board and not castled."),
  r("opening", "bad", "lost_castling", "Gave up the right to castle", "You moved your king or rook and can't castle anymore."),
  r("opening", "bad", "f_pawn_weakening", "Weakened the king with the f-pawn", "You pushed the pawn next to your king early, opening a path to it."),
  r("opening", "bad", "edge_pawn_moves", "Edge pawn moves in the opening", "You spent opening moves pushing edge pawns instead of developing."),
  r("opening", "bad", "knight_on_rim", "Knight on the edge", "You put a knight on the edge of the board where it does little."),
  r("opening", "bad", "queen_pawn_grab", "Grabbed a pawn with the queen", "You went pawn-hunting with your queen in the opening."),
  r("opening", "good", "castled_early", "Castled on time", "You got your king safe early."),
  r("opening", "good", "developed_piece", "Developed a piece", "You brought a new knight or bishop into the game."),
  r("opening", "neutral", "book_move", "Book move", "A standard opening move."),
  j("opening", "bad", "ignored_center", "Ignored the center", "The move did nothing for the center while the opponent took it.", { ask: { phases: O } }),
  j("opening", "bad", "opening_trap_fell", "Fell for an opening trap", "The move falls for a known early trap.", { ask: { phases: O } }),
  j("opening", "bad", "blocked_own_pieces", "Blocked your own pieces", "The move gets in the way of your own bishop or pawns.", { ask: { phases: OM } }),
  j("opening", "bad", "premature_attack_opening", "Attacked before developing", "You started an attack before your pieces were out.", { ask: { phases: O } }),

  // ---- King safety (rule) ---------------------------------------------------------
  r("king", "bad", "weakened_king_shelter", "Weakened your king's shelter", "You moved a pawn that was protecting your king."),
  r("king", "bad", "king_under_fire", "King under fire", "Several enemy pieces were aiming at your king."),
  r("king", "bad", "opened_lines_to_king", "Opened lines to your king", "Your move opened a path for enemy pieces toward your king."),
  r("king", "bad", "king_walk", "Took a king walk", "You moved your king out into the open."),
  j("king", "bad", "neglected_king_safety", "Neglected king safety", "You focused elsewhere while your king was getting exposed.", { ask: { phases: OM } }),

  // ---- Pawn structure (rule) -----------------------------------------------------
  r("structure", "bad", "created_doubled_pawns", "Doubled your pawns", "You ended up with two pawns stacked on the same file."),
  r("structure", "bad", "created_isolated_pawn", "Isolated a pawn", "You left a pawn with no friendly pawns beside it."),
  r("structure", "bad", "gave_passed_pawn", "Gave your opponent a passed pawn", "Your opponent got a pawn nothing can stop from advancing."),
  r("structure", "good", "created_passed_pawn", "Created a passed pawn", "You made a pawn that nothing can stop from advancing."),
  j("structure", "bad", "weak_squares", "Created weak squares", "Your pawn move left holes the opponent's pieces can sit in.", { ask: { phases: ME } }),
  j("structure", "bad", "overextended_pawns", "Pushed pawns too far", "Your pawns ran too far ahead and became targets.", { ask: { phases: ME } }),

  // ---- Trades and material (rule) ------------------------------------------------
  r("trade", "bad", "traded_when_behind", "Traded while behind", "You swapped pieces while down material, which usually helps the opponent."),
  r("trade", "good", "traded_when_ahead", "Traded while ahead", "You swapped pieces while up material: good technique."),
  r("trade", "bad", "gave_up_bishop_pair", "Gave up the bishop pair", "You traded a bishop for a knight and lost your two-bishop advantage."),
  r("trade", "neutral", "even_trade", "Even trade", "You traded pieces of equal value."),
  r("trade", "bad", "queen_trade_when_behind", "Traded queens while behind", "You traded queens while losing on material."),

  // ---- Clock (rule) ---------------------------------------------------------------
  r("clock", "bad", "time_scramble", "Time scramble", "You had under 30 seconds left."),
  r("clock", "bad", "low_time", "Low on time", "You had under a minute left."),
  r("clock", "bad", "rushed_critical_move", "Rushed a critical move", "You moved in a few seconds at a moment that needed thought."),
  r("clock", "bad", "instant_blunder", "Blundered instantly", "You played a losing move almost instantly."),
  r("clock", "bad", "long_think_blunder", "Thought long, still blundered", "You spent a long time and still made a big mistake."),
  r("clock", "neutral", "long_think", "Long think", "You took much longer than usual on this move."),
  r("clock", "bad", "time_trouble_self_inflicted", "Fell behind on the clock", "You had far less time than your opponent."),

  // ---- Game context (rule) --------------------------------------------------------
  r("context", "bad", "blunder_when_winning", "Threw away a winning position", "You were winning and this move gave much of it back."),
  r("context", "bad", "mistake_when_equal", "Slipped in an equal position", "The game was even and this move put you behind."),
  r("context", "bad", "collapse_when_losing", "Made a bad position worse", "You were already worse and this move made it much worse."),
  r("context", "bad", "tilt_followup", "Mistake right after a mistake", "This came right after another big mistake of yours."),
  r("context", "bad", "recapture_reflex", "Automatic recapture", "You took back right away when something better was there."),
  r("context", "neutral", "forced_reply", "Only move", "This was your only legal move."),
  r("context", "good", "held_advantage", "Kept your advantage", "You were ahead and kept it with a solid move."),
  r("context", "good", "defended_threat", "Defended a threat", "Your opponent threatened something and you dealt with it."),

  // ---- Tactical judgment (jev) ----------------------------------------------------
  j("missed", "bad", "missed_overloaded_defender", "Missed an overloaded defender", "One of their pieces was guarding two things and you could have exploited it."),
  j("missed", "bad", "missed_removal_of_defender", "Missed removing the defender", "You could have captured or chased away the piece that was guarding something."),
  j("missed", "bad", "missed_deflection", "Missed a deflection", "You could have lured a defender away from its job."),
  j("missed", "bad", "missed_zwischenzug", "Missed an in-between move", "Instead of the obvious reply, a stronger in-between move (often a check) was there."),
  j("missed", "bad", "missed_counterattack", "Missed a counterattack", "Instead of defending, you could have hit back with a bigger threat."),
  j("blunder", "bad", "overloaded_own_defender", "Overloaded your own defender", "One of your pieces had to guard too many things at once."),
  j("blunder", "bad", "removed_own_defender", "Moved away a defender", "You moved a piece that was protecting something important."),
  j("blunder", "bad", "allowed_deflection", "Allowed a deflection", "You let your opponent lure your defender away."),
  j("blunder", "bad", "allowed_x_ray", "Allowed an x-ray attack", "Your opponent's piece could attack through one of yours to another behind it."),
  j("blunder", "bad", "allowed_perpetual", "Allowed a perpetual check", "You let your opponent force a draw by checking forever.", { ask: { phases: ME } }),
  j("blunder", "bad", "miscounted_exchange", "Miscounted attackers and defenders", "You started a trade without counting how many pieces attacked and defended the square."),

  // ---- Strategy (jev) -----------------------------------------------------------------
  j("strategy", "bad", "aimless_move", "Aimless move", "The move didn't have a clear purpose.", { ask: { phases: ME } }),
  j("strategy", "bad", "passive_retreat", "Passive retreat", "You pulled a piece back when it was doing a good job.", { ask: { phases: ME } }),
  j("strategy", "bad", "premature_attack", "Attacked too early", "You attacked before your pieces were ready to support it.", { ask: { phases: M } }),
  j("strategy", "bad", "pawn_grab_greed", "Greedy pawn grab", "You went for a pawn and fell behind in development or safety."),
  j("strategy", "bad", "piece_misplaced", "Misplaced a piece", "You put a piece on a square where it does little.", { ask: { phases: ME } }),
  j("strategy", "bad", "lost_initiative", "Gave up the initiative", "You were pressing and this move let your opponent take over.", { ask: { phases: ME } }),
  j("strategy", "bad", "wrong_plan", "Wrong plan", "The idea behind the move doesn't fit the position.", { ask: { phases: ME } }),
  j("strategy", "bad", "ignored_opponent_plan", "Ignored the opponent's plan", "Your opponent was building something and you didn't stop it.", { ask: { phases: ME } }),
  j("strategy", "bad", "unnecessary_trade", "Unnecessary trade", "You traded off a good piece for no reason.", { ask: { phases: ME } }),
  j("strategy", "bad", "bad_bishop", "Locked in your own bishop", "Your pawns ended up on the same color as your bishop, blocking it.", { ask: { phases: ME } }),
  j("strategy", "bad", "rook_inactive", "Inactive rook", "Your rook stayed passive instead of taking an open line.", { ask: { phases: ME } }),
  j("strategy", "bad", "gave_up_center", "Gave up the center", "You let the opponent take control of the middle of the board.", { ask: { phases: OM } }),
  j("strategy", "bad", "overcomplicated", "Overcomplicated", "There was a simple safe move and you chose a risky one."),

  // ---- Endgame (jev) ----------------------------------------------------------------
  j("endgame", "bad", "passive_king_endgame", "Passive king in the endgame", "In the endgame your king should come forward and fight; it stayed back.", { ask: { phases: E } }),
  j("endgame", "bad", "ignored_passed_pawn", "Ignored a passed pawn", "A passed pawn needed to be pushed or stopped and you didn't.", { ask: { phases: E } }),
  j("endgame", "bad", "wrong_pawn_push", "Wrong pawn push", "You pushed the wrong pawn and it hurt your endgame.", { ask: { phases: E } }),
  j("endgame", "bad", "failed_conversion", "Failed to convert", "You were winning the endgame and let it slip.", { ask: { phases: E } }),
  j("endgame", "bad", "rook_behind_wrong", "Rook in the wrong place", "In rook endgames the rook belongs behind passed pawns; it wasn't.", { ask: { phases: E } }),
  j("endgame", "bad", "missed_simplification", "Didn't simplify when ahead", "You were ahead and could have traded down to an easy win.", { ask: { phases: ME } }),
  j("endgame", "bad", "opposition_error", "Opposition mistake", "In a king and pawn endgame you lost the key king face-off.", { ask: { phases: E } }),

  // ---- Thinking habits (jev) ------------------------------------------------------------
  j("thinking", "bad", "didnt_check_threats", "Didn't check the opponent's threat", "You didn't ask what your opponent's last move was threatening."),
  j("thinking", "bad", "hope_chess", "Hope chess", "You played a move hoping your opponent wouldn't see the reply."),
  j("thinking", "bad", "one_move_thinking", "Only thought one move ahead", "You looked at your move but not at the opponent's best answer."),
  j("thinking", "bad", "tunnel_vision", "Tunnel vision", "You were so focused on one part of the board you missed the rest."),
  j("thinking", "bad", "impulsive", "Impulsive move", "You played the first move that came to mind."),
  j("thinking", "bad", "didnt_scan_forcing_moves", "Didn't look for checks and captures", "There was a strong check or capture and you didn't look for it."),
  j("thinking", "bad", "assumed_forced_recapture", "Assumed you had to recapture", "You took back automatically when another move was better."),
  j("thinking", "bad", "relaxed_when_winning", "Relaxed when winning", "You were ahead and stopped being careful."),
  j("thinking", "bad", "panic_defense", "Panicked", "Under pressure, you played a desperate move instead of the calm defense."),
  j("thinking", "bad", "trusted_opponent_threat", "Respected a fake threat", "You defended against something that wasn't really a threat."),
  j("thinking", "bad", "copied_pattern_wrongly", "Played on autopilot", "You played a familiar-looking move without checking it fits this position."),

  // ---- Good habits (jev) --------------------------------------------------------------
  j("good", "good", "good_prophylaxis", "Good prevention", "You stopped your opponent's idea before it happened.", { ask: { on: "good" } }),
  j("good", "good", "improved_worst_piece", "Improved your worst piece", "You brought a poorly placed piece into the game.", { ask: { on: "good", phases: ME } }),
  j("good", "good", "good_defense", "Calm defense", "You defended accurately under pressure.", { ask: { on: "good" } }),
  j("good", "good", "active_king_endgame", "Active king", "You used your king as a fighting piece in the endgame.", { ask: { on: "good", phases: E } }),
  j("good", "good", "good_simplification", "Simplified well", "You traded down into an easy position while ahead.", { ask: { on: "good", phases: ME } }),
  j("good", "good", "seized_open_file", "Took an open file", "You put a rook on an open line.", { ask: { on: "good", phases: ME } }),
  j("good", "good", "created_threat", "Created a real threat", "Your move set up a threat your opponent had to answer.", { ask: { on: "good" } }),
];

export const TAG_BY_ID = new Map(TAGS.map((t) => [t.id, t]));
export const RULE_TAGS = TAGS.filter((t) => t.source === "rule");
export const JEV_TAGS = TAGS.filter((t) => t.source === "jev");

export function tagPlain(id: string): string {
  return TAG_BY_ID.get(id)?.plain ?? id;
}
export function tagName(id: string): string {
  return TAG_BY_ID.get(id)?.label ?? id;
}

/** Why the move was played (one answer per move). */
export const INTENTS = [
  { id: "develop", label: "Develop", description: "Bring a piece into the game or castle." },
  { id: "control_center", label: "Control the center", description: "Take or hold the middle of the board." },
  { id: "attack_king", label: "Attack the king", description: "Go after the opponent's king." },
  { id: "attack_piece", label: "Attack a piece", description: "Attack or chase an enemy piece." },
  { id: "win_material", label: "Win material", description: "Capture something or set up winning material." },
  { id: "trade", label: "Trade", description: "Swap pieces." },
  { id: "recapture", label: "Recapture", description: "Take back after the opponent captured." },
  { id: "defend_piece", label: "Defend a piece", description: "Protect or move away a threatened piece." },
  { id: "defend_king", label: "Defend the king", description: "Make the king safer or stop an attack on it." },
  { id: "prevent_idea", label: "Prevent an idea", description: "Stop something the opponent wanted to do." },
  { id: "improve_piece", label: "Improve a piece", description: "Move a piece to a better square without a direct threat." },
  { id: "push_pawn", label: "Push a pawn", description: "Advance a pawn, including toward promotion." },
  { id: "escape_check", label: "Escape check", description: "Get out of check." },
  { id: "waiting", label: "No clear purpose", description: "No clear purpose; a waiting or random move." },
] as const;

/** The underlying reason for a mistake (one answer per flagged move). */
export const ROOT_CAUSES_V2 = [
  { id: "missed_opponent_threat", label: "Missed the opponent's threat", description: "The opponent's last move created a threat and the player didn't notice it." },
  { id: "didnt_see_reply", label: "Didn't see their reply", description: "The player didn't see the opponent's strongest answer to this move." },
  { id: "missed_own_tactic", label: "Missed your own tactic", description: "A tactic was available for the player and they didn't see it." },
  { id: "miscalculated", label: "Miscalculated", description: "The player went for a sequence but got it wrong partway through." },
  { id: "time_pressure", label: "Time pressure", description: "Very little time on the clock forced a rushed move." },
  { id: "rushed_with_time", label: "Rushed with time left", description: "The player had time but moved too fast." },
  { id: "overthought", label: "Overthought it", description: "Spent a long time and still chose badly." },
  { id: "greed", label: "Greed", description: "Went for material and ignored the danger." },
  { id: "fear", label: "Played scared", description: "Defended against a threat that wasn't real, or played too cautiously." },
  { id: "relaxed_when_winning", label: "Relaxed when winning", description: "Was ahead and stopped being careful." },
  { id: "tilt", label: "Tilt", description: "Followed another recent mistake; frustration or panic." },
  { id: "unfamiliar_position", label: "Unfamiliar position", description: "Didn't know the typical plan or pattern in this kind of position." },
  { id: "principle_ignored", label: "Ignored a basic principle", description: "Broke a basic principle (development, king safety, center)." },
  { id: "unclear", label: "Unclear", description: "The facts don't point to one cause." },
] as const;
