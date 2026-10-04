import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";

let client: Anthropic | undefined;

/** Running token totals for this process (the batch runner reports cost from these). */
export const claudeUsage = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
export function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return client;
}

/**
 * One structured Claude call. The long, stable system prompt is cached; the
 * server-side refusal fallback is on (a declined request is re-run on a
 * fallback model inside the same call instead of failing).
 */
export async function structuredCall<S extends z.ZodType>(args: {
  model: string;
  system: string;
  user: string;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<{ data: z.infer<S>; model: string }> {
  const response = await anthropic().beta.messages.parse({
    model: args.model,
    max_tokens: args.maxTokens ?? 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: args.effort ?? "medium", format: zodOutputFormat(args.schema) },
    system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: args.user }],
  });
  claudeUsage.calls++;
  claudeUsage.input += response.usage.input_tokens;
  claudeUsage.output += response.usage.output_tokens;
  claudeUsage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
  claudeUsage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
  if (response.stop_reason === "refusal") throw new Error("Claude declined the request");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of output tokens");
  if (!response.parsed_output) throw new Error("Claude returned no parseable output");
  return { data: response.parsed_output as z.infer<S>, model: response.model };
}
