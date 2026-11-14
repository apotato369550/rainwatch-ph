import type { Metadata } from "next";
import localFont from "next/font/local";
import type { CSSProperties } from "react";
import { design } from "@/lib/design";
import "leaflet/dist/leaflet.css";
import "./globals.css";
const plex = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-plex",
  display: "swap",
});
export const metadata: Metadata = {
  title: "TANOM · Farm weather guidance",
  description:
    "Weather, water, soil estimates and seasonal planning for Philippine growers.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={plex.variable}
      style={
        {
          "--bg": design.background,
          "--panel": design.panel,
          "--raised": design.raised,
          "--text": design.text,
          "--muted": design.secondary,
          "--accent": design.accent,
          "--probability": design.probability,
          "--line": design.border,
          "--control-border": design.controlBorder,
        } as CSSProperties
      }
    >
      <body>
        <div className="weather-backdrop" aria-hidden="true">
          <svg className="weather-radar" viewBox="0 0 900 900" fill="none">
            <circle cx="450" cy="450" r="420" />
            <circle cx="450" cy="450" r="330" />
            <circle cx="450" cy="450" r="240" />
            <circle cx="450" cy="450" r="150" />
            <path d="M450 15v870M15 450h870" />
            <path className="weather-sweep" d="M450 450 660 86a420 420 0 0 1 210 364Z" />
          </svg>
          <svg className="weather-contours" viewBox="0 0 900 800" fill="none">
            <path d="M-100 150C180-80 460 140 330 360S460 650 850 550" />
            <path d="M-100 210C160-20 400 150 280 360S430 710 880 610" />
            <path d="M-100 270C140 40 340 160 230 360S400 770 910 670" />
            <path d="M-100 330C120 100 280 170 180 360S370 830 940 730" />
          </svg>
          <svg className="weather-nature" viewBox="0 0 1200 1600" fill="none">
            <g stroke="#B18432" strokeWidth="3"><circle cx="120" cy="140" r="48" fill="#E7C572" fillOpacity=".35"/><path d="M120 65V45M120 215v20M45 140H25M195 140h20M67 87 52 72M173 193l15 15M67 193l-15 15M173 87l15-15"/></g>
            <g stroke="#176B91" strokeWidth="3" fill="#C9E1E8" fillOpacity=".4"><path d="M870 340c-55 0-55-65-10-70 0-65 95-75 110-15 65-20 90 85 20 85Z"/><path d="m875 365-15 30m65-30-15 30m65-30-15 30m-40 5-15 30"/></g>
            <g stroke="#95764F" strokeWidth="3"><path d="M-60 1300q180-90 360 0t360 0M-60 1320q180-90 360 0t360 0M-60 1350q180-90 360 0t360 0M-60 1390q180-90 360 0t360 0"/><path d="m100 1300 20 20m60 10 10 25m160-30 20 20m-100 35 15 12"/></g>
          </svg>
          <span className="weather-orb weather-orb-one" />
          <span className="weather-orb weather-orb-two" />
        </div>
        {children}
      </body>
    </html>
  );
}
