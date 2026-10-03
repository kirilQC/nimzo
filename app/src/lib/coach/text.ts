/**
 * House style for everything Arthur writes: no dashes of any kind, short
 * sentences a beginner can follow, never the player's name as an opener and
 * never a harsh ranking of the game.
 */

/** Removes em, en and plain dashes: spaced dashes become commas, joined words become two words. */
export function noDashes(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/(\p{L})-(\p{L})/gu, "$1 $2")
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1 to $2")
    .replace(/-/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

const SENTENCE_RE = /[^.!?]+[.!?]*/g;

/** Sentences longer than `max` words, which read as run-ons. */
export function longSentences(text: string, max = 24): string[] {
  return (text.match(SENTENCE_RE) ?? []).map((s) => s.trim()).filter((s) => s.split(/\s+/).length > max);
}

/** Phrases the player asked never to see. */
const BANNED: [RegExp, string][] = [
  [/^\s*kiril\b/i, "starts with the player's name"],
  [/\b(toughest|worst|shakiest|weakest|poorest|ugliest)\b[^.]*\bgames?\b/i, "harsh ranking of the game"],
  [/\bone of your (worst|toughest|shakiest|weakest)\b/i, "harsh ranking of the game"],
  [/[—–]/, "uses a dash"],
];

export function bannedIn(text: string): string[] {
  return BANNED.filter(([re]) => re.test(text)).map(([, why]) => why);
}
