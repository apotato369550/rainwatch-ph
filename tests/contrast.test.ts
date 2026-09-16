import { test } from "node:test";
import assert from "node:assert/strict";
import { design } from "../lib/design";
import { severityColors } from "../lib/format";
function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function ratio(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("observatory text and essential graphics meet contrast targets", () => {
  for (const background of [design.background, design.panel, design.raised]) {
    for (const text of [design.text, design.secondary])
      assert.ok(ratio(text, background) >= 7, `${text} on ${background}`);
    for (const color of [
      design.accent,
      design.probability,
      design.controlBorder,
    ])
      assert.ok(ratio(color, background) >= 3, `${color} on ${background}`);
  }
  for (const color of Object.values(severityColors))
    assert.ok(ratio(color, design.panel) >= 4.5);
});
