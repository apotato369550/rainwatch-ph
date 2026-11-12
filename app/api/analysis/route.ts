import { NextRequest, NextResponse } from "next/server";
import { findMunicipality } from "@/lib/tanom/geography";
import { cropRecommendations } from "@/lib/tanom/crops";
import { randomUUID } from "node:crypto";
import {
  parseSelection,
  cacheKey,
  reportTTL,
  visitorHash,
  isFreeModel,
  systemPrompt,
} from "@/lib/tanom/analysis-server";
import { serverContext } from "@/lib/tanom/analysis-server-context";
import { admit, finish, StorageError } from "@/lib/tanom/analysis-server-store";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  const started = Date.now();
  let stage = "request";
  let upstreamStatus: number | undefined;
  let lease: { key: string; owner: string; ttl: number } | undefined;

  const fail = (error: string, code: string, status: number) => {
    // Never log credentials, coordinates, prompt content, or upstream error bodies.
    console.error("[analysis]", {
      stage,
      code,
      upstreamStatus,
      elapsedMs: Date.now() - started,
    });
    return NextResponse.json(
      { error, code, stage },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  };
  try {
    let input;
    try {
      if (Number(request.headers.get("content-length")) > 100000)
        return fail("Snapshot is too large.", "INVALID_REQUEST", 400);
      // Bound bytes while streaming, not after allocating an arbitrary public body.
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 100000) {
              await reader.cancel();
              return fail("Snapshot is too large.", "INVALID_REQUEST", 400);
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return fail("Send valid JSON coordinates.", "INVALID_REQUEST", 400);
    }
    if (!input || typeof input !== "object")
      return fail("Send valid JSON coordinates.", "INVALID_REQUEST", 400);
    const parsed = parseSelection(input);
    if (!parsed)
      return fail(
        "Send a valid bounded displayed snapshot.",
        "INVALID_REQUEST",
        400,
      );
    const { lat, lon } = parsed;
    const municipality = findMunicipality({ lat, lon });
    if (!municipality)
      return fail("Select a Philippine land location.", "INVALID_REQUEST", 400);
    const key = process.env.OPENROUTER_API_KEY,
      model = process.env.OPENROUTER_MODEL;
    if (!key || !model)
      return NextResponse.json(
        {
          error:
            "Configure OPENROUTER_API_KEY and OPENROUTER_MODEL on the server.",
        },
        { status: 503 },
      );
    if (!isFreeModel(model))
      return fail(
        "Only openrouter/free or a :free model is allowed.",
        "AI_CONFIG_INVALID",
        503,
      );
    const rawBudget = process.env.OPENROUTER_MAX_TOKENS?.trim();
    const maxTokens = rawBudget ? Number(rawBudget) : 4096;
    const reasoningEffort = process.env.OPENROUTER_REASONING_EFFORT?.trim();
    if (
      !Number.isInteger(maxTokens) ||
      maxTokens < 2048 ||
      maxTokens > 16384 ||
      (reasoningEffort &&
        !["none", "minimal", "low", "medium", "high", "xhigh", "max"].includes(
          reasoningEffort,
        ))
    ) {
      return fail(
        "Invalid server AI token budget or reasoning configuration.",
        "AI_CONFIG_INVALID",
        503,
      );
    }
    // Effort support differs by model. Only send it when explicitly configured.
    const reasoning = reasoningEffort ? { effort: reasoningEffort } : undefined;
    stage = "admission";
    let visitor: string;
    try {
      visitor = visitorHash(request.headers);
    } catch {
      return fail(
        "Configure trusted proxy IP identity on the server.",
        "AI_IDENTITY_UNAVAILABLE",
        503,
      );
    }
    const reportKey = cacheKey(parsed, model);
    const owner = randomUUID();
    const admission = await admit(reportKey, visitor, owner);
    if (admission.status === "cached") {
      return NextResponse.json(
        {
          ...admission.payload,
          cached: true,
          expiresAt: admission.expiresAt,
          ageSeconds: Math.max(
            0,
            Math.floor(
              (Date.now() - Date.parse(admission.payload.generatedAt)) / 1000,
            ),
          ),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (admission.status !== "allowed") {
      const codes = {
        burst: "AI_BURST_LIMIT",
        site_quota: "AI_SITE_QUOTA",
        visitor_quota: "AI_VISITOR_QUOTA",
        busy: "AI_BUSY",
      };
      const messages = {
        burst: "Too many analysis requests. Please retry later.",
        site_quota:
          "The site's daily AI allowance has been used. Try after 00:00 UTC.",
        visitor_quota:
          "This IP's daily AI allowance has been used. Try after 00:00 UTC.",
        busy: "Analysis is already in progress. Please retry later.",
      };
      return fail(messages[admission.status], codes[admission.status], 429);
    }
    lease = { key: reportKey, owner, ttl: reportTTL(parsed) };
    stage = "weather";
    const context = await serverContext(parsed);
    const recommendations =
      context.view === "environment"
        ? cropRecommendations(context.climate, context.elevation)
        : undefined;
    stage = "openrouter";
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model,
          // Hard zero-price route; no paid/model/provider fallback or retry.
          provider: {
            allow_fallbacks: false,
            max_price: { prompt: 0, completion: 0 },
          },
          max_tokens: maxTokens,
          ...(reasoning ? { reasoning } : {}),
          messages: [
            {
              role: "system",
              content: systemPrompt(parsed),
            },
            {
              role: "user",
              content: JSON.stringify({
                location: {
                  lat,
                  lon,
                  municipality: findMunicipality({ lat, lon })?.properties.name,
                },
                context,
                ...(context.view === "environment" ? { recommendations } : {}),
              }),
            },
          ],
        }),
      },
    );
    if (!response.ok) {
      upstreamStatus = response.status;
      if (response.status === 401 || response.status === 403)
        return fail(
          "AI provider authentication failed. Check the server API key and permissions.",
          "AI_AUTH_FAILED",
          503,
        );
      if (response.status === 402)
        return fail(
          "AI provider credits are unavailable. Check the OpenRouter account balance.",
          "AI_CREDITS_REQUIRED",
          503,
        );
      if (response.status === 429)
        return fail(
          "AI provider is rate limited. Please retry later.",
          "AI_RATE_LIMITED",
          429,
        );
      if (response.status === 400 || response.status === 404)
        return fail(
          "AI provider rejected the configured model or request. Check the server model configuration.",
          "AI_REQUEST_REJECTED",
          502,
        );
      return fail(
        "AI provider is temporarily unavailable. Please retry.",
        "AI_PROVIDER_UNAVAILABLE",
        502,
      );
    }
    const body = await response.json();
    const analysis = body.choices?.[0]?.message?.content;
    if (body.choices?.[0]?.finish_reason === "length") {
      const completion = body.usage?.completion_tokens;
      const reasoningTokens =
        body.usage?.completion_tokens_details?.reasoning_tokens;
      const tokenCount = (value: unknown) =>
        typeof value === "number" && Number.isFinite(value) && value >= 0
          ? value
          : undefined;
      console.warn("[analysis]", {
        stage: "openrouter",
        code: "AI_OUTPUT_LIMIT",
        maxTokens,
        completionTokens: tokenCount(completion),
        reasoningTokens: tokenCount(reasoningTokens),
      });
      // Never present a cut-off answer (even nonempty) as completed guidance.
      return fail(
        "The AI response reached its output limit. Increase the server token budget or reduce supported model reasoning effort.",
        "AI_OUTPUT_LIMIT",
        502,
      );
    }
    // Text may accompany a provider error, tool call or filtered/incomplete turn.
    // Only a completed plain-text response is eligible for durable caching.
    if (body.error || body.choices?.[0]?.finish_reason !== "stop") {
      return fail(
        "AI provider did not complete the analysis. Please retry later.",
        "AI_INCOMPLETE_OUTPUT",
        502,
      );
    }
    if (typeof analysis !== "string" || !analysis.trim()) {
      return fail(
        "AI provider returned no analysis. Please retry or check the configured model.",
        "AI_EMPTY_OUTPUT",
        502,
      );
    }
    const report = {
      analysis,
      model,
      observedAt:
        "observedAt" in context
          ? context.observedAt
          : context.climate.fetchedAt,
      generatedAt: new Date().toISOString(),
      contextFetchedAt:
        "fetchedAt" in context ? context.fetchedAt : context.climate.fetchedAt,
    };
    stage = "storage";
    await finish(lease.key, lease.owner, report, lease.ttl);
    const expiresAt = new Date(Date.now() + lease.ttl * 1000).toISOString();
    lease = undefined;
    return NextResponse.json(
      { ...report, cached: false, ageSeconds: 0, expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof StorageError)
      return fail(
        "Analysis storage is unavailable. Please retry later.",
        "AI_STORAGE_UNAVAILABLE",
        503,
      );
    const timeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    if (timeout)
      return fail(
        stage === "openrouter"
          ? "AI provider timed out. Please retry."
          : "Context data timed out. Please retry.",
        stage === "openrouter" ? "AI_TIMEOUT" : "CONTEXT_TIMEOUT",
        504,
      );
    return fail(
      stage === "weather"
        ? "Weather context could not be loaded or validated. Please retry."
        : "Analysis could not be completed. Please retry.",
      stage === "weather" ? "WEATHER_INVALID" : "ANALYSIS_FAILED",
      502,
    );
  } finally {
    if (lease) {
      // Failure releases only this owner's live lease; quota is never refunded.
      // If storage is down the lease expires, preventing permanent deadlocks.
      try {
        await finish(lease.key, lease.owner, null, lease.ttl);
      } catch {
        console.error("[analysis]", {
          stage: "storage",
          code: "AI_LEASE_RELEASE_FAILED",
        });
      }
    }
  }
}
