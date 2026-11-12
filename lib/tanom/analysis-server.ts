import "server-only";
import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { prompts, sharedPrompt } from "@/prompts";

// Deliberately project away every client-supplied snapshot/model/prompt field.
const selection = z.discriminatedUnion("view", [
  z.object({ view: z.literal("dashboard"), period: z.literal("current") }),
  z.object({
    view: z.literal("conditions"),
    period: z.enum(["hourly", "daily"]),
  }),
  z.object({ view: z.literal("seasonal"), period: z.enum(["6", "annual"]) }),
  z.object({ view: z.literal("environment"), period: z.literal("climate") }),
]);
const envelope = z.object({
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  ceb: z.boolean(),
  context: selection,
});
export function parseSelection(input: unknown) {
  const parsed = envelope.safeParse(input);
  if (!parsed.success) return null;
  const value = parsed.data;
  if (value.context.view === "conditions") value.context.period = "hourly";
  return value;
}
export type Selection = NonNullable<ReturnType<typeof parseSelection>>;
export function reportTTL(input: Selection) {
  if (
    input.context.view === "environment" ||
    (input.context.view === "seasonal" && input.context.period === "annual")
  )
    return 30 * 86400;
  return input.context.view === "seasonal" ? 7 * 86400 : 6 * 3600;
}
export const CONDITIONS_SCOPE =
  "\nServer report contract overrides any selected-variable wording: explain ALL supplied temperature, rainfall and modeled surface soil-moisture rows as one next-24-hour overview. period=hourly and variable=temperature are compatibility metadata, not a filter. Do not extrapolate beyond these rows.";
export function systemPrompt(input: Selection) {
  return (
    sharedPrompt +
    "\n" +
    prompts[input.context.view] +
    (input.context.view === "conditions" ? CONDITIONS_SCOPE : "") +
    "\nLanguage: " +
    (input.ceb ? "Cebuano" : "English")
  );
}
export function cacheKey(input: Selection, model: string) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: "server-context-v1", // Bump when snapshot semantics change.
        lat: input.lat,
        lon: input.lon,
        ceb: input.ceb,
        variant: input.context,
        model,
        modelVersion: process.env.ANALYSIS_MODEL_VERSION || "1",
        prompt: systemPrompt(input), // Actual prompt edits invalidate existing reports.
        maxTokens: process.env.OPENROUTER_MAX_TOKENS || "4096",
        reasoning: process.env.OPENROUTER_REASONING_EFFORT || "",
      }),
    )
    .digest("hex");
}
export function isFreeModel(model: string) {
  return (
    model === "openrouter/free" ||
    /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+:free$/.test(model)
  );
}
function canonicalIP(value: string) {
  if (!isIP(value)) throw new Error("Invalid proxy IP");
  if (isIP(value) === 4) return value;
  const ip = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  // Unify IPv4-mapped IPv6 and IPv4 to prevent alias quota bypasses.
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(ip);
  if (mapped) {
    const n = parseInt(mapped[1], 16) * 65536 + parseInt(mapped[2], 16);
    return [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join(".");
  }
  return ip;
}
export function visitorHash(headers: Headers) {
  const strategy = process.env.ANALYSIS_IP_STRATEGY;
  const secret = process.env.ANALYSIS_IP_HASH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("Missing IP hashing configuration");
  let ip: string;
  if (strategy === "single-header") {
    const name = process.env.ANALYSIS_IP_HEADER;
    if (!name || !/^[a-z0-9-]+$/.test(name))
      throw new Error("Missing trusted header configuration");
    ip = headers.get(name)?.trim() || "";
  } else if (strategy === "xff") {
    const hops = Number(process.env.ANALYSIS_TRUSTED_PROXY_HOPS);
    const raw = headers.get("x-forwarded-for") || "";
    if (!Number.isInteger(hops) || hops < 1 || hops > 10 || raw.length > 2048)
      throw new Error("Invalid proxy configuration");
    const chain = raw.split(",").map((part) => part.trim());
    if (chain.length < hops) throw new Error("Incomplete proxy chain");
    ip = chain[chain.length - hops];
  } else throw new Error("Explicit trusted proxy strategy required");
  return createHmac("sha256", secret).update(canonicalIP(ip)).digest("hex");
}
