import "server-only";
import { z } from "zod";
const payloadSchema = z.object({
  analysis: z.string().min(1),
  model: z.string().min(1),
  observedAt: z.string(),
  generatedAt: z.string().datetime(),
  contextFetchedAt: z.string(),
});
export type Report = z.infer<typeof payloadSchema>;
const admissionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("allowed") }),
  z.object({
    status: z.literal("cached"),
    payload: payloadSchema,
    expiresAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    status: z.enum(["burst", "site_quota", "visitor_quota", "busy"]),
  }),
]);
export class StorageError extends Error {}
export async function analysisRPC(
  name: "analysis_admit" | "analysis_finish",
  args: Record<string, unknown>,
) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing analysis storage");
    const target = new URL(url);
    if (
      target.protocol !== "https:" &&
      !(
        target.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(target.hostname)
      )
    )
      throw new Error("Invalid storage URL");
    const response = await fetch(new URL(`/rest/v1/rpc/${name}`, target), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error("Storage RPC failed");
    return await response.json();
  } catch {
    throw new StorageError("Analysis storage unavailable");
  }
}
export async function admit(key: string, visitor: string, owner: string) {
  try {
    return admissionSchema.parse(
      await analysisRPC("analysis_admit", {
        p_key: key,
        p_visitor: visitor,
        p_owner: owner,
      }),
    );
  } catch {
    throw new StorageError("Analysis storage unavailable");
  }
}
export async function finish(
  key: string,
  owner: string,
  payload: Report | null,
  ttl: number,
) {
  const result = await analysisRPC("analysis_finish", {
    p_key: key,
    p_owner: owner,
    p_payload: payload,
    p_ttl: ttl,
  });
  if (result !== true)
    throw new StorageError("Generation lease expired or lost");
}
