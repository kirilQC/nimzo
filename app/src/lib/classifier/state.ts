import type { ClassifyInput } from "./types";

/**
 * Renders the verified facts as clean structured state for a classifier.
 * Only engine output and deterministic facts go in; nothing invented.
 */
export function classifierState({ facts: f, maia }: ClassifyInput) {
  return {
    move: `${f.move_number}${f.side === "white" ? "." : "..."} ${f.san}`,
    player_side: f.side,
    severity: f.classification,
    game_phase_heuristic: f.phase,
    evaluation: {
      before_move_white_pov: f.eval_before,
      after_move_white_pov: f.eval_after,
      player_win_chance_before_pct: f.win_pct_before,
      player_win_chance_after_pct: f.win_pct_after,
    },
    engine_preferred: f.engine_best,
    other_good_moves: f.alternatives,
    opponent_best_reply_after_this_move: f.opponent_best_reply,
    moved_piece: f.move.piece,
    move_was_capture: f.move.capture,
    move_gave_check: f.move.check,
    move_was_castling: f.move.castle,
    material_balance_player_pov: f.material,
    clock: f.clock,
    previous_three_moves: f.previous_moves,
    tactical_detectors: f.detectors,
    human_likeness: maia
      ? {
          share_of_similar_rated_players_who_play_this_move: Math.round(maia.p_played * 100) / 100,
          share_who_find_engine_best_move: maia.p_best === null ? null : Math.round(maia.p_best * 100) / 100,
          rating: maia.elo,
        }
      : null,
  };
}
