"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { cropRecommendations } from "@/lib/tanom/crops";
import { CropCard } from "./crop-card";
type Crop = NonNullable<ReturnType<typeof cropRecommendations>>[number];
export function CropCarousel({ crops, ceb }: { crops: Crop[]; ceb: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [overflow, setOverflow] = useState(false);
  const id = useId();
  const signature = crops.map(c => c.id).join("|");
  useEffect(() => {
    const ids = signature.split("|");
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const frame = requestAnimationFrame(() => setOrder(ids));
    return () => cancelAnimationFrame(frame);
  }, [signature]);
  const sorted = [...crops].sort((a,b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
  function go(direction: number) {
    const node = track.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    const step = (node.children[0] as HTMLElement)?.offsetWidth + 12;
    let next = node.scrollLeft + direction * step;
    if (direction > 0 && node.scrollLeft >= max - 2) next = 0;
    if (direction < 0 && node.scrollLeft <= 2) next = max;
    node.scrollTo({ left: Math.max(0, Math.min(max, next)), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  useEffect(() => {
    const node = track.current;
    const region = root.current;
    if (!node || !region) return;
    let visible = false;
    let last = Date.now();
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; last = Date.now(); });
    observer.observe(region);
    const resize = new ResizeObserver(() => setOverflow(node.scrollWidth > node.clientWidth + 2));
    resize.observe(node);
    const reset = () => { last = Date.now(); };
    region.addEventListener("click", reset);
    region.addEventListener("keydown", reset);
    region.addEventListener("touchstart", reset);
    const timer = setInterval(() => {
      if (!visible || document.hidden || region.matches(":hover") || region.contains(document.activeElement) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { last = Date.now(); return; }
      if (Date.now() - last >= 6000) { go(1); last = Date.now(); }
    }, 250);
    return () => { clearInterval(timer); observer.disconnect(); resize.disconnect(); region.removeEventListener("click", reset); region.removeEventListener("keydown", reset); region.removeEventListener("touchstart", reset); };
  }, [signature]);
  return <div ref={root} className="crop-carousel" role="region" aria-roledescription="carousel" aria-label={ceb ? "Mga nahiuyon nga tanom" : "Qualifying crop matches"}>
    {overflow && <button className="crop-prev" aria-label={ceb ? "Miaging tanom" : "Previous crop"} aria-controls={id} onClick={() => go(-1)}>←</button>}
    <div id={id} ref={track} className="crop-carousel-track" tabIndex={0} aria-label="Crop cards; use left and right arrow keys" onKeyDown={e => { if(e.target !== e.currentTarget) return; if(e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); go(e.key === "ArrowRight" ? 1 : -1); } if(e.key === "Home" || e.key === "End") { e.preventDefault(); track.current?.scrollTo({left:e.key === "Home" ? 0 : track.current.scrollWidth}); } }}>
      {sorted.map((crop,i) => <div className="crop-carousel-slide" key={crop.id} role="group" aria-roledescription="slide" aria-label={`${i+1} / ${sorted.length}`}><CropCard crop={crop} ceb={ceb}/></div>)}
    </div>
    {overflow && <><button className="crop-next" aria-label={ceb ? "Sunod nga tanom" : "Next crop"} aria-controls={id} onClick={() => go(1)}>→</button></>}
  </div>;
}
