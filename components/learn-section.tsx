import { Cloud, CloudRain, Droplets, Gauge, Sprout, Wind } from "lucide-react";

const lessons = [
  { icon: CloudRain, term: "Rainfall total", copy: "This is the depth of water expected to fall over a time window. A larger total means more water may collect on streets, roofs, and low-lying ground." },
  { icon: Droplets, term: "Chance of rain", copy: "This is the highest chance for any one forecast hour in the next day. It is not the chance that it will rain at some point during the whole day." },
  { icon: Cloud, term: "Peak rainfall window", copy: "The single forecast hour with the most expected rain. Use it as a heads-up for when a shower may be strongest, not a guarantee." },
  { icon: Wind, term: "Humidity, clouds & wind", copy: "These describe how moist, cloudy, and breezy the air is. They help explain the forecast but do not, on their own, mean rain is certain." },
  { icon: Sprout, term: "Surface soil moisture", copy: "This estimates how wet the top layer of soil is. Wetter ground contributes to the experimental stress indicator, but it does not measure drains or flooding." },
  { icon: Gauge, term: "CAPE", copy: "CAPE is a measure of atmospheric energy that can support thunderstorms. It can add to the indicator, but it cannot predict a storm by itself." },
];

export function LearnSection() {
  return (
    <section id="learn" className="learn-section content-section" aria-labelledby="learn-title">
      <div className="section-intro">
        <span className="eyebrow">Rain, explained simply</span>
        <h2 id="learn-title">Know what you&apos;re looking at.</h2>
        <p>RainWatch turns weather-model data into useful context. Here&apos;s what each number means—and what it cannot tell you.</p>
      </div>
      <div className="lesson-grid">
        {lessons.map(({ icon: Icon, term, copy }) => (
          <article className="lesson-card" key={term}>
            <span className="lesson-icon"><Icon size={22} /></span>
            <h3>{term}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
