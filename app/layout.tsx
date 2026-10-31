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
    "Weather, water, soil estimates and seasonal planning for Cebu growers.",
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
      <body>{children}</body>
    </html>
  );
}
