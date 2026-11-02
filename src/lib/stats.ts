import { startOfWeek } from './format';
import type { ActivitySummary } from './types';

export type Totals = {
  distanceM: number;
  count: number;
  durationS: number;
  elevGainM: number;
};

export const EMPTY_TOTALS: Totals = { distanceM: 0, count: 0, durationS: 0, elevGainM: 0 };

export function totalsOf(activities: ActivitySummary[]): Totals {
  return activities.reduce<Totals>(
    (acc, a) => ({
      distanceM: acc.distanceM + a.distanceM,
      count: acc.count + 1,
      durationS: acc.durationS + a.durationS,
      elevGainM: acc.elevGainM + a.elevGainM,
    }),
    { ...EMPTY_TOTALS },
  );
}

export function activitiesBetween(
  activities: ActivitySummary[],
  fromMs: number,
  toMs: number,
): ActivitySummary[] {
  return activities.filter((a) => a.startedAt >= fromMs && a.startedAt < toMs);
}

export type WeekBucket = {
  weekStart: number;
  label: string;
  distanceM: number;
  count: number;
};

/** Oldest-first buckets ending with the current week. */
export function weeklyBuckets(activities: ActivitySummary[], weeks = 8, now = Date.now()): WeekBucket[] {
  const thisWeek = startOfWeek(now);
  const buckets: WeekBucket[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = thisWeek - i * 7 * 86400000;
    const weekEnd = weekStart + 7 * 86400000;
    const inWeek = activitiesBetween(activities, weekStart, weekEnd);
    const d = new Date(weekStart);
    buckets.push({
      weekStart,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      distanceM: inWeek.reduce((sum, a) => sum + a.distanceM, 0),
      count: inWeek.length,
    });
  }

  return buckets;
}

export type Records = {
  longest: ActivitySummary | null;
  fastest: ActivitySummary | null;
  biggestClimb: ActivitySummary | null;
};

export function recordsOf(activities: ActivitySummary[]): Records {
  let longest: ActivitySummary | null = null;
  let fastest: ActivitySummary | null = null;
  let biggestClimb: ActivitySummary | null = null;

  for (const a of activities) {
    if (!longest || a.distanceM > longest.distanceM) longest = a;
    if (!biggestClimb || a.elevGainM > biggestClimb.elevGainM) biggestClimb = a;
    if (a.distanceM >= 1000 && a.avgPaceS && (!fastest || a.avgPaceS < (fastest.avgPaceS ?? Infinity))) {
      fastest = a;
    }
  }

  return { longest, fastest, biggestClimb };
}
