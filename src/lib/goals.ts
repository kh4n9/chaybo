import { addDays } from './calendar';
import { startOfDay, startOfMonth, startOfYear } from './format';
import type { ActivitySummary } from './types';

const DAY_MS = 86400000;

export type GoalProgress = {
  targetM: number;
  doneM: number;
  pct: number;
  remainingM: number;
  daysLeft: number;
};

export function progressBetween(
  activities: ActivitySummary[],
  fromMs: number,
  toMs: number,
  targetM: number,
  now: number,
  periodEndMs: number,
): GoalProgress {
  const doneM = activities
    .filter((activity) => activity.startedAt >= fromMs && activity.startedAt < toMs)
    .reduce((sum, activity) => sum + activity.distanceM, 0);

  return {
    targetM,
    doneM,
    pct: targetM > 0 ? Math.min(1, doneM / targetM) : 0,
    remainingM: Math.max(0, targetM - doneM),
    daysLeft: Math.max(0, Math.ceil((periodEndMs - now) / DAY_MS)),
  };
}

export function monthProgress(
  activities: ActivitySummary[],
  now: number,
  targetKm: number,
): GoalProgress {
  const from = startOfMonth(now);
  const d = new Date(from);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return progressBetween(activities, from, to, targetKm * 1000, now, to);
}

export function yearProgress(
  activities: ActivitySummary[],
  now: number,
  targetKm: number,
): GoalProgress {
  const from = startOfYear(now);
  const to = new Date(new Date(from).getFullYear() + 1, 0, 1).getTime();
  return progressBetween(activities, from, to, targetKm * 1000, now, to);
}

/**
 * Streak that survives up to `freezes` missed days. Frozen days keep the chain
 * alive but do not increase the count, matching how most running apps behave.
 */
export function currentStreakWithFreeze(
  activities: ActivitySummary[],
  now: number,
  freezes: number,
): number {
  if (activities.length === 0) return 0;

  const days = new Set<number>();
  let earliest = Number.MAX_SAFE_INTEGER;
  for (const activity of activities) {
    const day = startOfDay(activity.startedAt);
    days.add(day);
    if (day < earliest) earliest = day;
  }

  let cursor = startOfDay(now);
  if (!days.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!days.has(cursor)) return 0;
  }

  let streak = 0;
  let freezesLeft = Math.max(0, Math.round(freezes));
  const limit = addDays(earliest, -7);

  while (cursor >= limit) {
    if (days.has(cursor)) {
      streak += 1;
    } else if (freezesLeft > 0) {
      freezesLeft -= 1;
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/** Number of freezes the runner has consumed inside the current streak. */
export function freezesUsed(activities: ActivitySummary[], now: number, freezes: number): number {
  const total = Math.max(0, Math.round(freezes));
  if (total === 0 || activities.length === 0) return 0;

  const days = new Set(activities.map((activity) => startOfDay(activity.startedAt)));
  let earliest = Number.MAX_SAFE_INTEGER;
  for (const day of days) if (day < earliest) earliest = day;

  let cursor = startOfDay(now);
  if (!days.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!days.has(cursor)) return 0;
  }

  let used = 0;
  let freezesLeft = total;
  const limit = addDays(earliest, -7);

  while (cursor >= limit) {
    if (days.has(cursor)) {
      // Day with a run: keeps the chain alive without spending a freeze.
    } else if (freezesLeft > 0) {
      freezesLeft -= 1;
      used += 1;
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  return used;
}
