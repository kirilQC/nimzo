import type { Classification } from "./math";

/** chess.com's move labels in their summary order, with their badge colours. */
export const MOVE_LABELS = [
  { id: "brilliant", name: "Brilliant", color: "#26C2A3" },
  { id: "great", name: "Great", color: "#749BBF" },
  { id: "book", name: "Book", color: "#D5A47D" },
  { id: "best", name: "Best", color: "#81B64C" },
  { id: "excellent", name: "Excellent", color: "#81B64C" },
  { id: "good", name: "Good", color: "#95B776" },
  { id: "inaccuracy", name: "Inaccuracy", color: "#F7C631" },
  { id: "mistake", name: "Mistake", color: "#FFA459" },
  { id: "miss", name: "Miss", color: "#FF7769" },
  { id: "blunder", name: "Blunder", color: "#FA412D" },
] as const satisfies readonly { id: Exclude<Classification, "forced">; name: string; color: string }[];

export type LabelId = (typeof MOVE_LABELS)[number]["id"];
export const LABEL_BY_ID = Object.fromEntries(MOVE_LABELS.map((l) => [l.id, l])) as Record<LabelId, (typeof MOVE_LABELS)[number]>;

export function isLabelId(c: string | null | undefined): c is LabelId {
  return !!c && c in LABEL_BY_ID;
}

/** Move-list suffix, as chess.com prints it after the move. */
export const LABEL_SUFFIX: Partial<Record<LabelId, string>> = { brilliant: "!!", great: "!", inaccuracy: "?!", mistake: "?", blunder: "??" };
