import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../app/api/analysis/route";
import { environmentContext } from "../lib/tanom/analysis-contract";
import { defaultPoint } from "../lib/tanom/geography";
import { environmentFixture, climateFixture } from "./browser/tanom-fixtures";
test("analysis route validates context and handles upstream failures", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error,
    originalWarn = console.warn;
  const diagnostics: unknown[][] = [];
  console.error = (...args: unknown[]) => diagnostics.push(args);
  console.warn = (...args: unknown[]) => diagnostics.push(args);
  t.after(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });
  const savedBudget = process.env.OPENROUTER_MAX_TOKENS,
    savedEffort = process.env.OPENROUTER_REASONING_EFFORT;
  delete process.env.OPENROUTER_MAX_TOKENS;
  delete process.env.OPENROUTER_REASONING_EFFORT;
  t.after(() => {
    if (savedBudget === undefined) delete process.env.OPENROUTER_MAX_TOKENS;
    else process.env.OPENROUTER_MAX_TOKENS = savedBudget;
    if (savedEffort === undefined)
      delete process.env.OPENROUTER_REASONING_EFFORT;
    else process.env.OPENROUTER_REASONING_EFFORT = savedEffort;
  });
  const key = process.env.OPENROUTER_API_KEY,
    model = process.env.OPENROUTER_MODEL;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = key;
    if (model === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = model;
  });
  process.env.OPENROUTER_API_KEY = "fixture";
  process.env.OPENROUTER_MODEL = "fixture-model";
  let mode = "success";
  let sent:
    | {
        max_tokens: number;
        reasoning?: { effort: string };
        messages: { content: string }[];
      }
    | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/api/environment")) {
      if (mode === "weather-failure")
        return Response.json(
          { error: "private provider detail" },
          { status: 502 },
        );
      if (mode === "weather-malformed") return Response.json({});
      return Response.json({
        ...environmentFixture(),
        hourlyConditions: [
          {
            time: "2026-01-01",
            temperature: 25,
            rainfall: 1,
            soilMoisture: 0.3,
          },
        ],
        hourlySoil: [{ time: "2026-01-01", soilMoisture: 0.3 }],
      });
    }
    if (url.includes("/api/climate-profile"))
      return mode === "climate-failure"
        ? Response.json({ error: "unavailable" }, { status: 502 })
        : Response.json(climateFixture);
    sent = JSON.parse(String(init?.body));
    if (mode.startsWith("status-"))
      return Response.json(
        { error: "private upstream detail" },
        { status: Number(mode.slice(7)) },
      );
    if (mode === "provider-failure")
      return Response.json({ error: "unavailable" }, { status: 502 });
    if (mode === "timeout") throw new DOMException("Timed out", "TimeoutError");
    return Response.json({
      choices: [
        {
          finish_reason:
            mode === "length" || mode === "partial-length" ? "length" : "stop",
          message: {
            content:
              mode === "empty" || mode === "length"
                ? " "
                : "Conditions.\n\n- Check drainage.",
          },
        },
      ],
    });
  };
  const snapshot = environmentContext(environmentFixture(), climateFixture);
  const request = (
    body: unknown = { ...defaultPoint, ceb: false, context: snapshot },
  ) =>
    POST(
      new NextRequest("http://localhost/api/analysis", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    );
  await t.test("success sends climate and computed matches", async () => {
    const response = await request();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.model, "fixture-model");
    assert.ok(body.observedAt);
    const context = JSON.parse(sent!.messages[1].content);
    assert.ok(context.context.climate);
    assert.equal(context.context.view, "environment");
    assert.ok(context.recommendations.length >= 2);
    assert.equal(typeof context.location.municipality, "string");
    assert.match(sent!.messages[0].content, /English/);
    assert.equal(sent!.max_tokens, 4096);
    assert.equal(sent!.reasoning, undefined);
  });
  await t.test(
    "bounded configured budget and supported effort are forwarded",
    async () => {
      process.env.OPENROUTER_MAX_TOKENS = "8192";
      process.env.OPENROUTER_REASONING_EFFORT = "low";
      assert.equal((await request()).status, 200);
      assert.equal(sent!.max_tokens, 8192);
      assert.deepEqual(sent!.reasoning, { effort: "low" });
      delete process.env.OPENROUTER_MAX_TOKENS;
      delete process.env.OPENROUTER_REASONING_EFFORT;
    },
  );
  for (const budget of ["900", "16385", "Infinity", "abc", "4096.5"])
    await t.test("invalid budget " + budget, async () => {
      process.env.OPENROUTER_MAX_TOKENS = budget;
      assert.equal((await request()).status, 503);
      delete process.env.OPENROUTER_MAX_TOKENS;
    });
  await t.test("partial output is never presented as complete", async () => {
    mode = "partial-length";
    const response = await request();
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.code, "AI_OUTPUT_LIMIT");
    assert.equal(body.analysis, undefined);
    mode = "success";
  });
  await t.test("Cebuano prompt", async () => {
    await request({ ...defaultPoint, ceb: true, context: snapshot });
    assert.match(sent!.messages[0].content, /Cebuano/);
  });
  await t.test("climate fallback", async () => {
    mode = "success";
    assert.equal(
      (
        await request({
          ...defaultPoint,
          ceb: false,
          context: environmentContext(environmentFixture(), null),
        })
      ).status,
      200,
    );
    const context = JSON.parse(sent!.messages[1].content);
    assert.equal(context.context.climate, null);
    assert.equal(context.recommendations, null);
  });
  await t.test("invalid coordinates", async () => {
    assert.equal(
      (await request({ lat: 0, lon: 0, ceb: false, context: snapshot })).status,
      400,
    );
  });
  await t.test("missing config", async () => {
    delete process.env.OPENROUTER_API_KEY;
    assert.equal((await request()).status, 503);
    process.env.OPENROUTER_API_KEY = "fixture";
  });
  for (const failure of ["provider-failure", "empty"])
    await t.test(failure, async () => {
      mode = failure;
      assert.equal((await request()).status, 502);
    });
  await t.test("provider timeout is explicit", async () => {
    mode = "timeout";
    const response = await request();
    assert.equal(response.status, 504);
    assert.equal((await response.json()).code, "AI_TIMEOUT");
  });
  for (const [status, code] of [
    [401, "AI_AUTH_FAILED"],
    [402, "AI_CREDITS_REQUIRED"],
    [429, "AI_RATE_LIMITED"],
    [404, "AI_REQUEST_REJECTED"],
  ] as const)
    await t.test("provider " + status, async () => {
      mode = "status-" + status;
      const response = await request();
      const body = await response.json();
      assert.equal(body.code, code);
      assert.equal(body.stage, "openrouter");
      assert.ok(!JSON.stringify(body).includes("private"));
    });
  for (const [failure, code] of [["length", "AI_OUTPUT_LIMIT"]])
    await t.test(failure, async () => {
      mode = failure;
      assert.equal((await (await request()).json()).code, code);
    });
  await t.test("malformed input returns 400", async () => {
    assert.equal((await request(null)).status, 400);
  });
  assert.ok(!JSON.stringify(diagnostics).includes("private"));
  assert.ok(!JSON.stringify(diagnostics).includes("fixture-model"));
});
