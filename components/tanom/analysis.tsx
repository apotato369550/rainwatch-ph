"use client";
import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/tanom/contracts";
export function Analysis({ point, ceb }: { point: Point; ceb: boolean }) {
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const t = (en: string, ce: string) => (ceb ? ce : en);
  async function generate() {
    if (controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...point, ceb }),
        signal: active.signal,
      });
      const body = await response.json();
      if (!response.ok) {
        const errors: Record<string, [string, string]> = {
          WEATHER_UNAVAILABLE: [
            "Weather context is unavailable. Retry when weather data is available.",
            "Walay datos sa panahon. Sulayi pag-usab kon anaa na ang datos.",
          ],
          WEATHER_INVALID: [
            "Weather context could not be loaded. Please retry.",
            "Dili makarga ang datos sa panahon. Sulayi pag-usab.",
          ],
          AI_AUTH_FAILED: [
            "AI provider authentication failed. Check the server API key and permissions.",
            "Napakyas ang pag-ila sa AI provider. Susihon ang API key ug pagtugot sa server.",
          ],
          AI_CREDITS_REQUIRED: [
            "AI provider credits are unavailable. Check the OpenRouter account balance.",
            "Walay credits sa AI provider. Susihon ang balanse sa OpenRouter.",
          ],
          AI_RATE_LIMITED: [
            "AI provider is rate limited. Please retry later.",
            "Daghan na ang hangyo sa AI provider. Sulayi unya.",
          ],
          AI_REQUEST_REJECTED: [
            "AI provider rejected the configured model or request. Check the server model configuration.",
            "Gibalibaran sa AI provider ang modelo o hangyo. Susihon ang modelo sa server.",
          ],
          AI_PROVIDER_UNAVAILABLE: [
            "AI provider is temporarily unavailable. Please retry.",
            "Temporaryong dili magamit ang AI provider. Sulayi pag-usab.",
          ],
          AI_OUTPUT_LIMIT: [
            "The AI response reached its output limit before returning analysis. Check the configured model.",
            "Naabot ang limitasyon sa tubag sa AI sa wala pa ang pagtuki. Susihon ang modelo.",
          ],
          AI_EMPTY_OUTPUT: [
            "AI provider returned no analysis. Please retry or check the configured model.",
            "Walay pagtuki nga gibalik sa AI provider. Sulayi pag-usab o susiha ang modelo.",
          ],
          AI_TIMEOUT: [
            "AI provider timed out. Please retry.",
            "Nahutdan og oras ang AI provider. Sulayi pag-usab.",
          ],
          CONTEXT_TIMEOUT: [
            "Context data timed out. Please retry.",
            "Nahutdan og oras ang pagkarga sa datos. Sulayi pag-usab.",
          ],
        };
        const message =
          typeof body.code === "string" ? errors[body.code] : undefined;
        throw new Error(
          message
            ? t(...message)
            : response.status === 503
              ? t(
                  "AI analysis is not configured on the server.",
                  "Wala pa ma-configure ang AI sa server.",
                )
              : t(
                  "Analysis unavailable. Please retry.",
                  "Walay pagtuki. Sulayi pag-usab.",
                ),
        );
      }
      if (typeof body.analysis !== "string" || !body.analysis.trim())
        throw new Error(
          t(
            "Analysis unavailable. Please retry.",
            "Walay pagtuki. Sulayi pag-usab.",
          ),
        );
      if (!active.signal.aborted) setResult(body.analysis);
    } catch (e) {
      if (!active.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : t(
                "Analysis unavailable. Please retry.",
                "Walay pagtuki. Sulayi pag-usab.",
              ),
        );
    } finally {
      if (!active.signal.aborted) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  const blocks = result.split(/\n\s*\n/);
  return (
    <section className="tanom-panel analysis-panel">
      <h2>{t("AI analysis", "Pagtuki sa AI")}</h2>
      <p>
        {t(
          "Generate context about this location’s weather, climate, and crop matches. Coordinates and modeled data are sent to OpenRouter; this is not a field assessment.",
          "Paghimo og konteksto sa panahon, klima ug mga tanom. Ipadala ang lokasyon ug datos ngadto sa OpenRouter; dili kini pagtimbang sa uma.",
        )}
      </p>
      <button disabled={busy} onClick={generate}>
        {busy
          ? t("Generating…", "Naghimo…")
          : error
            ? t("Retry analysis", "Sulayi pag-usab")
            : t("Generate analysis", "Paghimo og pagtuki")}
      </button>
      {error && <p role="alert">{error}</p>}
      <div
        className="analysis-content"
        role="region"
        aria-label={t("Generated analysis", "Nahimong pagtuki")}
        tabIndex={result ? 0 : undefined}
        aria-live="polite"
      >
        {blocks.map(
          (block, i) =>
            block.trim() &&
            (block.trim().startsWith("- ") ? (
              <ul key={i}>
                {block
                  .split("\n")
                  .filter(Boolean)
                  .map((line, j) => (
                    <li key={j}>{line.replace(/^[-*]\s+/, "")}</li>
                  ))}
              </ul>
            ) : (
              <p key={i}>{block}</p>
            )),
        )}
      </div>
    </section>
  );
}
