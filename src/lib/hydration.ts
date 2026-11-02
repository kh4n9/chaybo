/** Rough hydration reminder for a run. */
export function hydrationMl(distanceM: number, tempC?: number | null): number {
  const base = (distanceM / 1000) * 150; // ~150 ml per km
  const heat = tempC != null && tempC >= 28 ? (tempC - 27) * 60 : 0;
  return Math.round(base + heat);
}