/**
 * Arthur's expressions: one portrait per mood (public/brand/arthur/<id>.webp).
 * Code picks the expression for game events; for answers to questions, Claude
 * picks from QA_EXPRESSIONS.
 */
export const EXPRESSIONS = {
  warm_smile: "Kind smile, head tilted. Default when idle.",
  neutral: "Calm, attentive, facing you.",
  explaining: "Talking, one open hand. Walking you through a move.",
  explaining_animated: "Animated, both hands, looking aside. Telling a dramatic moment.",
  thinking: "Hand on chin, eyes up. Working something out.",
  puzzled: "Scratching his head under the cap. A strange move.",
  stern: "Frowning, serious. A real mistake, a warning.",
  listening: "Hand on cheek, fond smile. Listening to you.",
  pleased: "Satisfied smile. Mild approval.",
  delighted: "Big laugh, hand out. You did something good.",
  thumbs_up: "Thumbs up. A good move or a win.",
  pondering: "Finger on chin, looking up. Considering.",
  shocked: "Wide eyes, mouth open. A blunder.",
  skeptical: "Side glance, pursed lips. A dubious move.",
  worried: "Scratching his head, worried. Trouble, often on the clock.",
  questioning: "Palm up: what were you thinking?",
  disappointed: "Grumpy frown. Threw away a good position.",
  eureka: "Finger up, bright idea. A brilliant move or the key trick.",
  dreamy: "Hand on cheek, content. Nostalgic.",
  oops: "Hand over mouth. A silly slip.",
  earnest: "Both hands, sincere. Explaining a habit to fix.",
  hand_to_ear: "Hand cupped to ear. Waiting for your question.",
  glum: "Downcast frown. A loss.",
  celebrating: "Fist pump, laughing. A big win.",
  sympathetic: "Eyes down, sad. A tough loss.",
  sleepy: "Eyes closed, head on hand. You've been away a while.",
  pointing: "Pointing at you, smiling. Your homework.",
  cap_tip: "Tipping his cap. Hello or goodbye.",
  concentrating: "Hands clasped at his mouth. The critical moment.",
  laughing: "Head back, laughing. Something genuinely funny.",
  shrug: "Palms up. A draw, or something the data can't answer.",
  kind_smile: "Gentle smile. Encouragement after a mistake.",
} as const;

export type Expression = keyof typeof EXPRESSIONS;

export function expressionSrc(e: Expression): string {
  return `/brand/arthur/${e}.webp`;
}

/** Expressions Claude may choose when answering a question (all except purely situational ones). */
export const QA_EXPRESSIONS = Object.keys(EXPRESSIONS).filter((e) => !["sleepy", "cap_tip", "hand_to_ear", "listening", "thinking"].includes(e)) as Expression[];

const pick = <T,>(options: T[], seed: number): T => options[Math.abs(seed) % options.length]!;

/** Expression while Arthur explains one of your flagged moves. */
export function expressionForMistake(args: {
  severity: "blunder" | "miss" | "mistake" | "inaccuracy";
  ply: number;
  clockMs: number | null;
  missedMate?: boolean;
  winBefore?: number | null; // your win% before the move, if known
}): Expression {
  const { severity, ply } = args;
  if (args.clockMs !== null && args.clockMs < 60_000) return "worried";
  if (args.missedMate) return "questioning";
  if (severity === "blunder") {
    if ((args.winBefore ?? 0) >= 70) return "disappointed"; // threw away a winning position
    return pick<Expression>(["shocked", "oops", "disappointed"], ply);
  }
  if (severity === "mistake") return pick<Expression>(["stern", "questioning", "skeptical"], ply);
  return pick<Expression>(["skeptical", "puzzled", "pondering"], ply);
}

/** Expression for the game summary, from the result and accuracy. */
export function expressionForGame(result: "win" | "loss" | "draw" | null, accuracy: number | null): Expression {
  if (result === "win") return (accuracy ?? 0) >= 80 ? "celebrating" : "thumbs_up";
  if (result === "draw") return "shrug";
  if (result === "loss") return (accuracy ?? 100) < 50 ? "sympathetic" : "earnest";
  return "explaining";
}

/** Expression for a session takeaway. */
export function expressionForSession(wins: number, losses: number): Expression {
  if (wins > losses) return "thumbs_up";
  if (losses > wins) return "sympathetic";
  return "earnest";
}
