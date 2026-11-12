import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../app/api/analysis/route";
import { defaultPoint } from "../lib/tanom/geography";
import {
  parseSelection,
  cacheKey,
  reportTTL,
  visitorHash,
  isFreeModel,
} from "../lib/tanom/analysis-server";

const minimal = {
  ...defaultPoint,
  ceb: false,
  context: { view: "conditions", period: "daily" },
};
test("server report selection, free model and IP boundary", () => {
  const saved = { ...process.env };
  try {
    const selection = parseSelection({
      ...minimal,
      model: "paid",
      context: { ...minimal.context, rows: "injected", variable: "soil" },
    })!;
    assert.deepEqual(selection.context, {
      view: "conditions",
      period: "hourly",
    });
    assert.equal(
      parseSelection({
        ...minimal,
        context: { view: "unknown", period: "hourly" },
      }),
      null,
    );
    assert.equal(reportTTL(selection), 21600);
    const seasonal = parseSelection({
      ...minimal,
      context: { view: "seasonal", period: "6" },
    })!;
    assert.equal(reportTTL(seasonal), 604800);
    assert.equal(
      reportTTL(
        parseSelection({
          ...minimal,
          context: { view: "seasonal", period: "annual" },
        })!,
      ),
      2592000,
    );
    assert.equal(
      reportTTL(
        parseSelection({
          ...minimal,
          context: { view: "environment", period: "climate" },
        })!,
      ),
      2592000,
    );
    const key = cacheKey(selection, "openrouter/free");
    assert.equal(key, cacheKey(parseSelection(minimal)!, "openrouter/free"));
    for (const changed of [
      { ...selection, lat: selection.lat + 0.000001 },
      { ...selection, ceb: true },
      seasonal,
    ])
      assert.notEqual(key, cacheKey(changed, "openrouter/free"));
    assert.notEqual(key, cacheKey(selection, "vendor/model:free"));
    process.env.ANALYSIS_MODEL_VERSION = "new";
    assert.notEqual(key, cacheKey(selection, "openrouter/free"));
    for (const model of ["openrouter/free", "vendor/model:free"])
      assert.ok(isFreeModel(model));
    for (const model of [
      "vendor/paid",
      "openrouter/auto",
      "vendor/free",
      "vendor/model:free,paid",
      "@preset",
      " :free",
    ])
      assert.ok(!isFreeModel(model));
    process.env.ANALYSIS_IP_HASH_SECRET = "a".repeat(32);
    delete process.env.ANALYSIS_IP_STRATEGY;
    assert.throws(() =>
      visitorHash(new Headers({ "x-forwarded-for": "192.0.2.1" })),
    );
    process.env.ANALYSIS_IP_STRATEGY = "single-header";
    process.env.ANALYSIS_IP_HEADER = "x-real-ip";
    assert.throws(() =>
      visitorHash(new Headers({ "x-real-ip": "192.0.2.1, 192.0.2.2" })),
    );
    const ipHash = visitorHash(new Headers({ "x-real-ip": "192.0.2.1" }));
    assert.equal(
      ipHash,
      visitorHash(new Headers({ "x-real-ip": "::ffff:192.0.2.1" })),
    );
    assert.equal(
      visitorHash(new Headers({ "x-real-ip": "2001:db8::1" })),
      visitorHash(new Headers({ "x-real-ip": "2001:0db8:0:0:0:0:0:1" })),
    );
    process.env.ANALYSIS_IP_STRATEGY = "xff";
    process.env.ANALYSIS_TRUSTED_PROXY_HOPS = "2";
    assert.equal(
      ipHash,
      visitorHash(
        new Headers({ "x-forwarded-for": "spoof, 192.0.2.1, 10.0.0.1" }),
      ),
    );
    assert.throws(() =>
      visitorHash(new Headers({ "x-forwarded-for": "192.0.2.1" })),
    );
  } finally {
    process.env = saved;
  }
});

test("public analysis uses durable admission and authoritative provider snapshots", async (t) => {
  const env = { ...process.env };
  const originalFetch = globalThis.fetch,
    originalError = console.error,
    originalWarn = console.warn;
  t.after(() => {
    process.env = env;
    globalThis.fetch = originalFetch;
    console.error = originalError;
    console.warn = originalWarn;
  });
  const diagnostics: unknown[] = [];
  console.error = (...args) => diagnostics.push(args);
  console.warn = (...args) => diagnostics.push(args);
  Object.assign(process.env, {
    OPENROUTER_API_KEY: "fixture-secret",
    OPENROUTER_MODEL: "openrouter/free",
    NEXT_PUBLIC_SUPABASE_URL: "https://storage.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
    ANALYSIS_IP_STRATEGY: "single-header",
    ANALYSIS_IP_HEADER: "x-real-ip",
    ANALYSIS_IP_HASH_SECRET: "a".repeat(32),
  });
  delete process.env.OPENROUTER_MAX_TOKENS;
  delete process.env.OPENROUTER_REASONING_EFFORT;
  let admission = "allowed",
    mode = "success",
    finishOK = true;
  let sent: {
    model: string;
    provider: unknown;
    max_tokens: number;
    messages: { content: string }[];
  };
  let cached: Record<string, unknown> | undefined;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const epoch = Date.parse("2026-11-12T00:00:00Z") / 1000;
  globalThis.fetch = async (input, init) => {
    const url = String(input),
      body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });
    if (url.includes("analysis_admit")) {
      if (mode === "storage-failure") return Response.json({}, { status: 521 });
      if (mode === "storage-timeout")
        throw new DOMException("private", "TimeoutError");
      return Response.json(
        admission === "cached"
          ? {
              status: "cached",
              payload: cached,
              expiresAt: new Date(Date.now() + 10000).toISOString(),
            }
          : { status: admission },
      );
    }
    if (url.includes("analysis_finish")) {
      if (body.p_payload) cached = body.p_payload;
      return Response.json(finishOK);
    }
    if (url.includes("api.open-meteo.com/v1/forecast")) {
      if (mode === "weather-failure") return Response.json({}, { status: 502 });
      if (mode === "weather-malformed") return Response.json({});
      const values = (n: number, value: number) =>
        Array.from({ length: n }, () => value);
      return Response.json({
        elevation: 100,
        current: {
          time: epoch,
          temperature_2m: 28,
          precipitation: 1,
          weather_code: 3,
        },
        hourly: {
          time: Array.from({ length: 48 }, (_, i) => epoch + 3600 * i),
          soil_moisture_0_to_1cm: values(48, 0.3),
          soil_temperature_0cm: values(48, 25),
          temperature_2m: values(48, 28),
          precipitation: values(48, 1),
        },
        daily: {
          time: Array.from({ length: 7 }, (_, i) => epoch + 86400 * i),
          temperature_2m_max: values(7, 30),
          precipitation_sum: values(7, 10),
          precipitation_probability_max: values(7, 50),
        },
      });
    }
    if (url.includes("archive-api") || url.includes("seasonal-api")) {
      const archive = url.includes("archive-api");
      const start = Date.parse(archive ? "1991-01-01" : "2026-11-01");
      const n = archive ? (Date.parse("2021-01-01") - start) / 86400000 : 183;
      return Response.json({
        daily: {
          time: Array.from({ length: n }, (_, i) =>
            new Date(start + i * 86400000).toISOString().slice(0, 10),
          ),
          temperature_2m_mean: Array(n).fill(25),
          precipitation_sum: Array(n).fill(1),
        },
      });
    }
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    sent = body;
    if (mode.startsWith("status-"))
      return Response.json(
        { error: "private provider detail" },
        { status: Number(mode.slice(7)) },
      );
    if (mode === "timeout") throw new DOMException("private", "TimeoutError");
    return Response.json({
      choices: [
        {
          finish_reason:
            mode === "finish-missing"
              ? undefined
              : mode === "length"
                ? "length"
                : mode.startsWith("finish-")
                  ? mode.slice(7)
                  : "stop",
          message: { content: mode === "empty" ? " " : "Check drainage." },
        },
      ],
    });
  };
  const request = (body: unknown = minimal, ip = "192.0.2.1") =>
    POST(
      new NextRequest("http://localhost/api/analysis", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "x-real-ip": ip },
      }),
    );
  await t.test(
    "ignores supplied snapshots; conditions is hourly all-variable next24",
    async () => {
      const response = await request({
        ...minimal,
        context: {
          ...minimal.context,
          variable: "soil",
          rows: [{ rainfall: 999999 }],
          observedAt: "untrusted",
          prompt: "injected",
        },
      });
      assert.equal(response.status, 200);
      const report = await response.json();
      assert.equal(report.cached, false);
      assert.ok(
        report.generatedAt && report.contextFetchedAt && report.expiresAt,
      );
      const content = JSON.parse(sent.messages[1].content);
      assert.equal(content.context.period, "hourly");
      assert.equal(content.context.variable, "temperature");
      assert.equal(content.context.rows.length, 24);
      assert.equal(content.context.rows[0].rainfall, 1);
      assert.equal(content.context.rows[0].temperature, 28);
      assert.equal(content.context.rows[0].soil, 0.3);
      assert.ok(!JSON.stringify(sent).includes("injected"));
      assert.match(
        sent.messages[0].content,
        /ALL supplied temperature, rainfall/,
      );
      assert.deepEqual(sent.provider, {
        allow_fallbacks: false,
        max_price: { prompt: 0, completion: 0 },
      });
      assert.equal(calls[0].body.p_visitor?.toString().length, 64);
      assert.equal(calls.at(-1)!.body.p_ttl, 21600);
    },
  );
  await t.test(
    "cross-visitor cache never refetches snapshots or provider",
    async () => {
      admission = "cached";
      calls.length = 0;
      const response = await request(minimal, "192.0.2.2");
      assert.equal(response.status, 200);
      assert.equal((await response.json()).cached, true);
      assert.equal(calls.length, 1);
      admission = "allowed";
    },
  );
  for (const [view, period, ttl] of [
    ["dashboard", "current", 21600],
    ["seasonal", "6", 604800],
    ["seasonal", "annual", 2592000],
    ["environment", "climate", 2592000],
  ] as const)
    await t.test(view + period + " server context and TTL", async () => {
      calls.length = 0;
      const response = await request({
        ...minimal,
        context: { view, period, climate: "untrusted" },
      });
      assert.equal(response.status, 200);
      assert.equal(calls.at(-1)!.body.p_ttl, ttl);
      const content = JSON.parse(sent.messages[1].content);
      if (view === "environment") {
        assert.equal(content.context.climate.months.length, 12);
        assert.ok(content.recommendations.length);
      }
    });
  for (const [state, code] of [
    ["burst", "AI_BURST_LIMIT"],
    ["site_quota", "AI_SITE_QUOTA"],
    ["visitor_quota", "AI_VISITOR_QUOTA"],
    ["busy", "AI_BUSY"],
  ])
    await t.test(state, async () => {
      admission = state;
      calls.length = 0;
      const response = await request();
      assert.equal(response.status, 429);
      assert.equal((await response.json()).code, code);
      assert.equal(calls.length, 1);
      admission = "allowed";
    });
  for (const [failure, code, status] of [
    ["status-401", "AI_AUTH_FAILED", 503],
    ["status-403", "AI_AUTH_FAILED", 503],
    ["status-402", "AI_CREDITS_REQUIRED", 503],
    ["status-429", "AI_RATE_LIMITED", 429],
    ["status-400", "AI_REQUEST_REJECTED", 502],
    ["status-404", "AI_REQUEST_REJECTED", 502],
    ["status-500", "AI_PROVIDER_UNAVAILABLE", 502],
    ["timeout", "AI_TIMEOUT", 504],
    ["length", "AI_OUTPUT_LIMIT", 502],
    ["empty", "AI_EMPTY_OUTPUT", 502],
    ["finish-error", "AI_INCOMPLETE_OUTPUT", 502],
    ["finish-tool_calls", "AI_INCOMPLETE_OUTPUT", 502],
    ["finish-content_filter", "AI_INCOMPLETE_OUTPUT", 502],
    ["finish-unknown", "AI_INCOMPLETE_OUTPUT", 502],
    ["finish-missing", "AI_INCOMPLETE_OUTPUT", 502],
    ["weather-failure", "WEATHER_INVALID", 502],
    ["weather-malformed", "WEATHER_INVALID", 502],
    ["storage-failure", "AI_STORAGE_UNAVAILABLE", 503],
    ["storage-timeout", "AI_STORAGE_UNAVAILABLE", 503],
  ] as const)
    await t.test(failure, async () => {
      mode = failure;
      calls.length = 0;
      const response = await request();
      assert.equal(response.status, status);
      assert.equal((await response.json()).code, code);
      assert.ok(
        calls.filter((c) => c.url.includes("openrouter.ai")).length <= 1,
      );
      if (!failure.startsWith("storage"))
        assert.equal(calls.at(-1)!.body.p_payload, null);
      mode = "success";
    });
  await t.test("lost lease never returns generated output", async () => {
    finishOK = false;
    const response = await request();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "AI_STORAGE_UNAVAILABLE");
    finishOK = true;
  });
  await t.test("paid config rejected before storage", async () => {
    process.env.OPENROUTER_MODEL = "vendor/paid";
    calls.length = 0;
    assert.equal((await request()).status, 503);
    assert.equal(calls.length, 0);
    process.env.OPENROUTER_MODEL = "openrouter/free";
  });
  await t.test("missing trusted IP fails closed", async () => {
    calls.length = 0;
    assert.equal((await request(minimal, "")).status, 503);
    assert.equal(calls.length, 0);
  });
  await t.test(
    "oversized declared body is rejected before reading",
    async () => {
      calls.length = 0;
      const request = new NextRequest("http://localhost/api/analysis", {
        method: "POST",
        body: JSON.stringify(minimal),
        headers: { "content-length": "100001", "x-real-ip": "192.0.2.1" },
      });
      const response = await POST(request);
      assert.equal(response.status, 400);
      assert.equal(request.bodyUsed, false);
      assert.equal(calls.length, 0);
    },
  );
  await t.test("body bytes are bounded without content-length", async () => {
    calls.length = 0;
    // UTF-8 bytes exceed the cap although JS character count is below it.
    const request = new NextRequest("http://localhost/api/analysis", {
      method: "POST",
      body: JSON.stringify({ ...minimal, ignored: "é".repeat(60000) }),
      headers: { "x-real-ip": "192.0.2.1" },
    });
    assert.equal(request.headers.get("content-length"), null);
    const response = await POST(request);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Snapshot is too large.");
    assert.equal(calls.length, 0);
  });
  for (const body of [
    null,
    { ...minimal, lat: 0, lon: 0 },
    { ...minimal, context: {} },
  ])
    assert.equal((await request(body)).status, 400);
  await t.test("invalid budget remains rejected", async () => {
    process.env.OPENROUTER_MAX_TOKENS = "10";
    assert.equal((await request()).status, 503);
    delete process.env.OPENROUTER_MAX_TOKENS;
  });
  assert.ok(!JSON.stringify(diagnostics).includes("private"));
  assert.ok(!JSON.stringify(diagnostics).includes("fixture-secret"));
});
