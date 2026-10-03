import { z } from "zod";

// Shapes verified against live Published-Data API responses (Oct 2026).

export const playerSideSchema = z.object({
  username: z.string(),
  rating: z.number().optional(),
  result: z.string(), // win | checkmated | resigned | timeout | agreed | repetition | stalemate | ...
});

export const chesscomGameSchema = z.object({
  url: z.string().url(),
  uuid: z.string().optional(),
  pgn: z.string().optional(),
  time_control: z.string(),
  time_class: z.string(),
  end_time: z.number(),
  rated: z.boolean().optional(),
  rules: z.string(),
  white: playerSideSchema,
  black: playerSideSchema,
  eco: z.string().optional(), // chess.com opening URL
  accuracies: z.object({ white: z.number(), black: z.number() }).partial().optional(),
});
export type ChesscomGame = z.infer<typeof chesscomGameSchema>;

export const monthArchiveSchema = z.object({ games: z.array(z.unknown()) });

export const archivesSchema = z.object({ archives: z.array(z.string().url()) });

const ratingEntry = z.object({ last: z.object({ rating: z.number(), date: z.number() }).optional() }).passthrough();

export const statsSchema = z
  .object({
    chess_rapid: ratingEntry.optional(),
    chess_blitz: ratingEntry.optional(),
    chess_bullet: ratingEntry.optional(),
    chess_daily: ratingEntry.optional(),
  })
  .passthrough();
export type ChesscomStats = z.infer<typeof statsSchema>;
