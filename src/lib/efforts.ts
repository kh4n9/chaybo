import { haversine } from './geo';
import type { Activity, TrackPoint } from './types';

export const EFFORT_DISTANCES = [
  { key: '400m', label: '400 m', meters: 400 },
  { key: '1k', label: '1 km', meters: 1000 },
  { key: '1mi', label: '1 dặm', meters: 1609.344 },
  { key: '5k', label: '5 km', meters: 5000 },
  { key: '10k', label: '10 km', meters: 10000 },
] as const;

export type EffortKey = (typeof EFFORT_DISTANCES)[number]['key'];

export type Effort = {
  /** Seconds spent covering exactly `targetM`. */
  durationS: number;
  paceSPerKm: number;
  /** Timestamp of the interpolated start of the effort. */
  startedAt: number;
};

function cumulativeDistance(points: TrackPoint[]): number[] {
  const cum = new Array<number>(points.length);
  cum[0] = 0;
  for (let i = 1; i < points.length; i++) {
    cum[i] = cum[i - 1] + haversine(points[i - 1], points[i]);
  }
  return cum;
}

/**
 * Fastest continuous window of `targetM` given a precomputed cumulative
 * distance array. The start time is interpolated inside the GPS segment that
 * crosses the target distance.
 */
function bestEffortWithCum(
  points: TrackPoint[],
  cum: number[],
  targetM: number,
): Effort | null {
  if (points.length < 2 || targetM <= 0) return null;
  if (cum[cum.length - 1] < targetM) return null;

  let best: Effort | null = null;
  let start = 0;

  for (let end = 1; end < points.length; end++) {
    while (start + 1 < end && cum[end] - cum[start + 1] >= targetM) start++;
    if (cum[end] - cum[start] < targetM) continue;

    const need = cum[end] - targetM;
    let startT = points[start].t;

    if (need > cum[start]) {
      const segment = cum[start + 1] - cum[start];
      const ratio = segment > 0 ? (need - cum[start]) / segment : 0;
      startT = points[start].t + ratio * (points[start + 1].t - points[start].t);
    }

    const durationS = (points[end].t - startT) / 1000;
    if (durationS <= 0) continue;

    if (best === null || durationS < best.durationS) {
      best = {
        durationS,
        paceSPerKm: durationS / (targetM / 1000),
        startedAt: Math.round(startT),
      };
    }
  }

  return best;
}

/** Fastest continuous window of `targetM` inside a route. */
export function bestEffort(points: TrackPoint[], targetM: number): Effort | null {
  if (points.length < 2 || targetM <= 0) return null;
  return bestEffortWithCum(points, cumulativeDistance(points), targetM);
}

/** Best effort for every supported distance, sharing one cumulative pass. */
export function bestEffortsFor(points: TrackPoint[]): Record<EffortKey, Effort | null> {
  const result = {
    '400m': null,
    '1k': null,
    '1mi': null,
    '5k': null,
    '10k': null,
  } as Record<EffortKey, Effort | null>;

  if (points.length < 2) return result;

  const cum = cumulativeDistance(points);
  for (const distance of EFFORT_DISTANCES) {
    result[distance.key] = bestEffortWithCum(points, cum, distance.meters);
  }
  return result;
}

export type PersonalBest = {
  key: EffortKey;
  label: string;
  meters: number;
  effort: Effort | null;
  activity: Activity | null;
};

/** All-time best effort for each distance, with the run that produced it. */
export function personalBests(activities: Activity[]): PersonalBest[] {
  const best: PersonalBest[] = EFFORT_DISTANCES.map((distance) => ({
    key: distance.key,
    label: distance.label,
    meters: distance.meters,
    effort: null,
    activity: null,
  }));

  for (const activity of activities) {
    const efforts = bestEffortsFor(activity.route);
    for (const row of best) {
      const effort = efforts[row.key];
      if (!effort) continue;
      if (!row.effort || effort.durationS < row.effort.durationS) {
        row.effort = effort;
        row.activity = activity;
      }
    }
  }

  return best;
}
