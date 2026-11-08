"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Keep the cards readable: reserve output space or fall back to natural stacking. */
export function EnvironmentLayout({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!enabled || !root) return;
    const crop = root.querySelector<HTMLElement>(".cropsection");
    const analysis = root.querySelector<HTMLElement>(".analysis-panel");
    if (!crop || !analysis) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = parseFloat(
          getComputedStyle(root).getPropertyValue("--dashboard-picker-height"),
        );
        const available = root.getBoundingClientRect().width - 24;
        const columnWidth = available - Math.max(360, available / 2.5);
        const probe = crop.cloneNode(true) as HTMLElement;
        probe.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;width:${Math.max(0, columnWidth)}px`;
        probe.setAttribute("aria-hidden", "true");
        probe.removeAttribute("aria-labelledby");
        probe
          .querySelectorAll("[id]")
          .forEach((el) => el.removeAttribute("id"));
        root.appendChild(probe);
        const cropHeight = probe.getBoundingClientRect().height;
        probe.remove();
        const analysisProbe = analysis.cloneNode(true) as HTMLElement;
        analysisProbe.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;width:${Math.max(0, columnWidth)}px;height:auto`;
        analysisProbe.setAttribute("aria-hidden", "true");
        root.appendChild(analysisProbe);
        const chrome = Array.from(analysisProbe.children)
          .filter((el) => !el.classList.contains("analysis-content"))
          .reduce((total, el) => {
            const style = getComputedStyle(el);
            return (
              total +
              el.getBoundingClientRect().height +
              parseFloat(style.marginTop) +
              parseFloat(style.marginBottom)
            );
          }, 0);
        analysisProbe.remove();
        const style = getComputedStyle(analysis);
        const padding =
          parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2;
        root.dataset.fit =
          cropHeight + chrome + padding + 24 + 96 <= height ? "true" : "false";
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(crop);
    Array.from(analysis.children)
      .filter((el) => !el.classList.contains("analysis-content"))
      .forEach((el) => observer.observe(el));
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return (
    <div ref={ref} className={enabled ? "environment-layout" : undefined}>
      {children}
    </div>
  );
}
