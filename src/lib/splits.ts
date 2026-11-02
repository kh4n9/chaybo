import { elevationGain, haversine } from './geo';
import type { Split, TrackPoint } from './types';

/**
 * Split the route into 1 km segments, interpolating the exact time the runner
 * crossed each kilometer mark. The trailing partial kilometer is included when
 * it is longer than 100 m.
 */
export function computeSplits(points: TrackPoint[]): Split[] {
  if (points.length < 2) return [];

  const splits: Split[] = [];
  let segStartIdx = 0;
  let segStartTime = points[0].t;
  let cum = 0;

  for (let i = 1; i < points.length; i++) {
    const stepDist = haversine(points[i - 1], points[i]);
    const before = cum;
    cum += stepDist;

    let guard = 0;
    while (cum >= (splits.length + 1) * 1000 && guard++ < 20) {
      const target = (splits.length + 1) * 1000;
      const ratio = stepDist > 0 ? (target - before) / stepDist : 1;
      const crossTime = points[i - 1].t + ratio * (points[i].t - points[i - 1].t);
      const durationS = (crossTime - segStartTime) / 1000;
      splits.push({
        km: splits.length + 1,
        distanceM: 1000,
        durationS,
        paceSPerKm: durationS,
        elevGainM: elevationGain(points.slice(segStartIdx, i + 1)),
      });
      segStartIdx = i;
      segStartTime = crossTime;
    }
  }

  const last = points[points.length - 1];
  const remainder = cum - splits.length * 1000;
  if (remainder > 100) {
    const durationS = (last.t - segStartTime) / 1000;
    if (durationS > 0) {
      splits.push({
        km: splits.length + 1,
        distanceM: remainder,
        durationS,
        paceSPerKm: durationS / (remainder / 1000),
        elevGainM: elevationGain(points.slice(segStartIdx)),
      });
    }
  }

  return splits;
}

export function bestPaceFromSplits(splits: Split[]): number | null {
  const full = splits.filter((s) => s.distanceM > 900);
  const pool = full.length > 0 ? full : splits;
  if (pool.length === 0) return null;
  return pool.reduce((min, s) => Math.min(min, s.paceSPerKm), Infinity);
}

/**
 * Fastest sustained 1 km inside the activity (rolling window), used as a
 * "best effort" stat on the detail screen.
 */
export function fastestKilometer(points: TrackPoint[]): number | null {
  if (points.length < 2) return null;

  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + haversine(points[i - 1], points[i]));
  }
  if (cum[cum.length - 1] < 1000) return null;

  let best: number | null = null;
  let start = 0;
  for (let end = 1; end < points.length; end++) {
    // Move `start` to the latest index that still covers at least 1 km.
    while (start + 1 < end && cum[end] - cum[start + 1] >= 1000) start++;
    if (cum[end] - cum[start] < 1000) continue;
    const seconds = (points[end].t - points[start].t) / 1000;
    if (seconds > 0 && (best === null || seconds < best)) best = seconds;
  }
  return best;
}
