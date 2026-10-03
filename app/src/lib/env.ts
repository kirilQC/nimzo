import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so `next build` works without every
 * key present; each accessor throws a clear error the first time it's used.
 */
const schema = z.object({
  CHESSCOM_USERNAME: z.string().min(1),
  CONTACT_EMAIL: z.string().email(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CLAUDE_MODEL_COACH: z.string().default("claude-opus-5-5"),
  CLAUDE_MODEL_REVIEW: z.string().default("claude-opus-5-5"),
  // Jev (TypeSafe) is called through OpenRouter's Decisions API.
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  JEV_MODEL: z.string().default("typesafe/jev-1.13"),
  VOYAGE_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse({
    ...process.env,
    // Accept Supabase's legacy key name too.
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${missing}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
