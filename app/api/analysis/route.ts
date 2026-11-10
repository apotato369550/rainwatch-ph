import { NextRequest, NextResponse } from "next/server";
import { findMunicipality } from "@/lib/tanom/geography";
import { cropRecommendations } from "@/lib/tanom/crops";
import { analysisRequestSchema } from "@/lib/tanom/analysis-contract";
import { prompts, sharedPrompt } from "@/prompts";
export async function POST(request: NextRequest) {
  const started = Date.now();
  let stage = "request";
  let upstreamStatus: number | undefined;

  const fail = (error: string, code: string, status: number) => {
    // Never log credentials, coordinates, prompt content, or upstream error bodies.
    console.error("[analysis]", {
      stage,
      code,
      upstreamStatus,
      elapsedMs: Date.now() - started,
    });
    return NextResponse.json({ error, code, stage }, { status });
  };
  try {
    let input;
    try {
      const raw = await request.text();
      if (raw.length > 100000)
        return fail("Snapshot is too large.", "INVALID_REQUEST", 400);
      input = JSON.parse(raw);
    } catch {
      return fail("Send valid JSON coordinates.", "INVALID_REQUEST", 400);
    }
    if (!input || typeof input !== "object")
      return fail("Send valid JSON coordinates.", "INVALID_REQUEST", 400);
    if (Number(request.headers.get("content-length")) > 100000)
      return fail("Snapshot is too large.", "INVALID_REQUEST", 400);
    const parsed = analysisRequestSchema.safeParse(input);
    if (!parsed.success)
      return fail(
        "Send a valid bounded displayed snapshot.",
        "INVALID_REQUEST",
        400,
      );
    const { lat, lon, ceb, context } = parsed.data;
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
          max_tokens: maxTokens,
          ...(reasoning ? { reasoning } : {}),
          messages: [
            {
              role: "system",
              content:
                sharedPrompt +
                "\n" +
                prompts[context.view] +
                "\nLanguage: " +
                (ceb ? "Cebuano" : "English"),
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
    if (typeof analysis !== "string" || !analysis.trim()) {
      return fail(
        "AI provider returned no analysis. Please retry or check the configured model.",
        "AI_EMPTY_OUTPUT",
        502,
      );
    }
    return NextResponse.json({
      analysis,
      model,
      observedAt:
        "observedAt" in context
          ? context.observedAt
          : context.climate.fetchedAt,
    });
  } catch (error) {
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
  }
}
