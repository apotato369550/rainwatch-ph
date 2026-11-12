"use client";
import { Fragment, useEffect, useState } from "react";
import type { AnalysisRequest } from "@/lib/tanom/analysis-contract";

type Report = {
  analysis: string;
  model: string;
  observedAt: string;
  generatedAt?: string;
  contextFetchedAt?: string;
  expiresAt?: string;
  ageSeconds?: number;
  cached?: boolean;
  receivedAt: string;
};
type Outcome =
  { report: Report; error?: never } | { error: string; report?: never };
export type AnalysisCache = Map<string, Promise<Outcome>>;

// Only paragraphs, lists and bold are interpreted. Everything else is escaped text.
function bold(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}
export function AnalysisText({ text }: { text: string }) {
  const blocks: { kind: "p" | "ul" | "ol"; lines: string[] }[] = [];
  let previous = "";
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      previous = "";
      continue;
    }
    const match = trimmed.match(/^(?:([-*])|\d+[.)])\s+(.+)$/);
    const kind = match ? (match[1] ? "ul" : "ol") : "p";
    if (previous === kind)
      blocks.at(-1)!.lines.push(match ? match[2] : trimmed);
    else blocks.push({ kind, lines: [match ? match[2] : trimmed] });
    previous = kind;
  }
  return blocks.map(({ kind, lines }, i) =>
    kind === "p" ? (
      <p key={i}>{bold(lines.join(" "))}</p>
    ) : kind === "ul" ? (
      <ul key={i}>
        {lines.map((line, j) => (
          <li key={j}>{bold(line)}</li>
        ))}
      </ul>
    ) : (
      <ol key={i}>
        {lines.map((line, j) => (
          <li key={j}>{bold(line)}</li>
        ))}
      </ol>
    ),
  );
}

async function load(request: AnalysisRequest, ceb: boolean): Promise<Outcome> {
  const t = (en: string, ce: string) => (ceb ? ce : en);
  try {
    const response = await fetch("/api/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = await response.json();
    if (!response.ok) {
      if (response.status === 429) {
        const inflight = /in.?flight|progress|busy/i.test(
          String(body.code) + " " + String(body.error),
        );
        return {
          error: inflight
            ? t(
                "An AI report is already in progress. Try again later; no automatic retry will run.",
                "Adunay AI report nga gihimo. Sulayi unya; walay awtomatikong pagsulay.",
              )
            : t(
                "AI request limit reached. Try again later; no automatic retry will run.",
                "Naabot ang limitasyon sa AI. Sulayi unya; walay awtomatikong pagsulay.",
              ),
        };
      }
      if (response.status === 503)
        return {
          error: t(
            "AI insights are temporarily unavailable. Try again later. Weather and charts remain available.",
            "Temporaryong walay AI insights. Sulayi unya. Magamit gihapon ang panahon ug mga grap.",
          ),
        };
      return {
        error: t(
          "AI analysis could not be loaded. You can retry manually.",
          "Dili makarga ang pagtuki sa AI. Mahimong sulayan pag-usab.",
        ),
      };
    }
    if (typeof body.analysis !== "string" || !body.analysis.trim())
      throw Error("Empty analysis");
    return {
      report: {
        analysis: body.analysis,
        model: typeof body.model === "string" ? body.model : "AI",
        observedAt: body.observedAt,
        generatedAt:
          typeof body.generatedAt === "string" ? body.generatedAt : undefined,
        contextFetchedAt:
          typeof body.contextFetchedAt === "string"
            ? body.contextFetchedAt
            : undefined,
        expiresAt:
          typeof body.expiresAt === "string" ? body.expiresAt : undefined,
        ageSeconds:
          typeof body.ageSeconds === "number" &&
          Number.isFinite(body.ageSeconds)
            ? body.ageSeconds
            : undefined,
        cached:
          body.cached === true ||
          body.cache === "hit" ||
          body.cache === "cached" ||
          body.cache?.hit === true,
        receivedAt: new Date().toISOString(),
      },
    };
  } catch {
    return {
      error: t(
        "AI analysis could not be loaded. You can retry manually.",
        "Dili makarga ang pagtuki sa AI. Mahimong sulayan pag-usab.",
      ),
    };
  }
}
export function Analysis({
  request,
  ceb,
  enabled,
  active,
  cache,
  title,
}: {
  request: AnalysisRequest | null;
  ceb: boolean;
  enabled: boolean;
  active: boolean;
  cache: AnalysisCache;
  title: string;
}) {
  const key = request
    ? JSON.stringify([
        request.lat,
        request.lon,
        ceb,
        request.context.view,
        request.context.period,
      ])
    : "";
  const [state, setState] = useState<{
    key: string;
    outcome: Outcome;
    reused: boolean;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const [visible, setVisible] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const t = (en: string, ce: string) => (ceb ? ce : en);
  const serialized = request ? JSON.stringify(request) : "";
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!enabled || !active || !visible || !key || !serialized) return;
    let alive = true;
    const reused = cache.has(key);
    if (!reused)
      cache.set(key, load(JSON.parse(serialized) as AnalysisRequest, ceb));
    void cache.get(key)!.then((outcome) => {
      if (alive) {
        setNow(Date.now());
        setState({ key, outcome, reused });
      }
    });
    return () => {
      alive = false;
    };
  }, [enabled, active, visible, key, serialized, cache, ceb, revision]);
  const current = state?.key === key ? state : null;
  const report = current?.outcome.report;
  useEffect(() => {
    if (!report?.expiresAt) return;
    const remaining = Date.parse(report.expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(remaining + 10, 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [report]);
  const date = (value: string) =>
    Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleString(ceb ? "ceb-PH" : "en-PH", {
          timeZone: "Asia/Manila",
          dateStyle: "medium",
          timeStyle: "short",
        }) + " PHT"
      : t("Unavailable", "Dili magamit");
  const expired = !!report?.expiresAt && Date.parse(report.expiresAt) <= now;
  const refresh = () => {
    cache.delete(key);
    setState(null);
    setRevision((n) => n + 1);
  };
  const age = report
    ? Math.max(
        0,
        Math.floor(
          (now -
            Date.parse(report.generatedAt ?? report.receivedAt) +
            (!report.generatedAt ? (report.ageSeconds ?? 0) * 1000 : 0)) /
            60000,
        ),
      )
    : 0;
  return (
    <section className="tanom-panel analysis-panel">
      <h2>
        {t("AI insights", "Mga pagtuki sa AI")} · {title}
      </h2>
      {!enabled ? (
        <p>
          {t(
            "Enable AI insights near the location controls for this point.",
            "I-enable ang AI insights duol sa pagpili sa lokasyon alang niining punto.",
          )}
        </p>
      ) : !request ? (
        <p role="status">
          {t(
            "Waiting for report data. Weather and charts remain available.",
            "Naghulat sa datos sa report. Magamit gihapon ang panahon ug grap.",
          )}
        </p>
      ) : !current ? (
        <p role="status">
          {t("Loading AI insights…", "Gikarga ang AI insights…")}
        </p>
      ) : null}
      {enabled && current?.outcome.error && (
        <div role="alert">
          <p>{current.outcome.error}</p>
          <button
            onClick={() => {
              cache.delete(key);
              setState(null);
              setRevision((n) => n + 1);
            }}
          >
            {t("Retry analysis", "Sulayi pag-usab")}
          </button>
        </div>
      )}
      {enabled && report && (
        <>
          <p className="analysis-provenance">
            {current.reused || report.cached
              ? t("Reused report", "Gigamit pag-usab nga report")
              : t("Report", "Report")}{" "}
            · {report.model}
            <br />
            {t("Data snapshot", "Snapshot sa datos")}: {date(report.observedAt)}
            <br />
            {t("Context retrieved", "Konteksto gikuha")}:{" "}
            {report.contextFetchedAt
              ? date(report.contextFetchedAt)
              : t("Unavailable", "Dili magamit")}
            <br />
            {report.generatedAt
              ? t("Generated", "Gihimo")
              : t(
                  "Received (generation time unavailable)",
                  "Nadawat (walay oras sa paghimo)",
                )}
            : {date(report.generatedAt ?? report.receivedAt)} · {age}{" "}
            {t("min old", "min ang edad")}
          </p>
          <p className="analysis-freshness" role="status">
            {expired
              ? t(
                  "Expired report — not current. Refresh manually to request a new report.",
                  "Na-expire nga report — dili kasamtangan. I-refresh aron mangayo og bag-ong report.",
                )
              : t(
                  "Saved data snapshot, not a live assessment; it may not reflect the latest weather.",
                  "Gitipig nga snapshot, dili live nga pagtimbang; basin dili pinakabag-ong panahon.",
                )}
            {report.expiresAt && (
              <>
                {" "}
                {t("Expires", "Ma-expire")}: {date(report.expiresAt)}.
              </>
            )}
          </p>
          {expired && (
            <button onClick={refresh}>
              {t("Refresh AI report", "I-refresh ang AI report")}
            </button>
          )}
          <div
            className="analysis-content"
            role="region"
            aria-label={t("Generated analysis", "Nahimong pagtuki")}
            tabIndex={0}
            aria-live="polite"
          >
            <AnalysisText text={report.analysis} />
          </div>
        </>
      )}
    </section>
  );
}
