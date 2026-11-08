export function displayBand(
  value: number | null | undefined,
  boundaries: number[],
) {
  if (value == null || !Number.isFinite(value)) return -1;
  return boundaries.filter((boundary) => value >= boundary).length;
}
export const rainBand = (value: number | null | undefined) =>
  value === 0 ? 0 : displayBand(value, [Number.MIN_VALUE, 2, 10, 30]);
export const soilBand = (value: number | null | undefined) =>
  displayBand(value, [0.1, 0.3, 0.45]);
export const elevationBand = (value: number | null | undefined) =>
  displayBand(value, [200, 500, 1000]);
