"use client";
import { useId, useRef, useState } from "react";
import type { cropRecommendations } from "@/lib/tanom/crops";
import { CropCard } from "./crop-card";
type Crop = NonNullable<ReturnType<typeof cropRecommendations>>[number];
export function CropCarousel({ crops, ceb }: { crops: Crop[]; ceb: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const id = useId();
  const t = (en: string, ce: string) => (ceb ? ce : en);
  function go(next: number) {
    const node = track.current;
    if (!node) return;
    const target = Math.max(0, Math.min(crops.length - 1, next));
    const slide = node.children[target] as HTMLElement | undefined;
    if (!slide) return;
    node.scrollTo({
      left: slide.offsetLeft - (node.children[0] as HTMLElement).offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    setIndex(target);
  }
  return (
    <div
      className="crop-carousel"
      role="region"
      aria-roledescription={t("carousel", "carousel")}
      aria-label={t("Qualifying crop matches", "Mga nahiuyon nga tanom")}
    >
      <div className="crop-carousel-controls">
        <button
          aria-label={t("Previous crop", "Miaging tanom")}
          aria-controls={id}
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          ←
        </button>
        <span role="status" aria-live="polite" aria-atomic="true">
          {t("Crop", "Tanom")} {index + 1} {t("of", "sa")} {crops.length}
        </span>
        <button
          aria-label={t("Next crop", "Sunod nga tanom")}
          aria-controls={id}
          disabled={index === crops.length - 1}
          onClick={() => go(index + 1)}
        >
          →
        </button>
      </div>
      <div
        id={id}
        className="crop-carousel-track"
        ref={track}
        tabIndex={0}
        aria-label={t(
          "Crop cards; use left and right arrow keys",
          "Mga tanom; gamita ang wala ug tuo nga arrow",
        )}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const next =
            event.key === "ArrowRight"
              ? index + 1
              : event.key === "ArrowLeft"
                ? index - 1
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? crops.length - 1
                    : null;
          if (next !== null) {
            event.preventDefault();
            go(next);
          }
        }}
        onScroll={() => {
          const node = track.current;
          if (!node) return;
          const slides = Array.from(node.children) as HTMLElement[];
          const start = slides[0]?.offsetLeft ?? 0;
          const nearest = slides.reduce(
            (best, slide, i) =>
              Math.abs(slide.offsetLeft - start - node.scrollLeft) <
              Math.abs(slides[best].offsetLeft - start - node.scrollLeft)
                ? i
                : best,
            0,
          );
          setIndex(nearest);
        }}
      >
        {crops.map((crop, i) => (
          <div
            className="crop-carousel-slide"
            key={crop.id}
            role="group"
            aria-roledescription={t("slide", "slide")}
            aria-label={`${i + 1} ${t("of", "sa")} ${crops.length}`}
          >
            <CropCard crop={crop} ceb={ceb} />
          </div>
        ))}
      </div>
    </div>
  );
}
