import { startOfDay, startOfMonth, startOfWeek } from './format';
import type { ActivitySummary } from './types';

const DAY_MS = 86400000;

/** Local-calendar day arithmetic that survives DST shifts. */
export function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export type DayStat = { distanceM: number; count: number };

/** Map of local midnight → distance/count for every day that has a run. */
export function runsByDay(activities: ActivitySummary[]): Map<number, DayStat> {
  const map = new Map<number, DayStat>();

  for (const activity of activities) {
    const day = startOfDay(activity.startedAt);
    const current = map.get(day);
    if (current) {
      current.distanceM += activity.distanceM;
      current.count += 1;
    } else {
      map.set(day, { distanceM: activity.distanceM, count: 1 });
    }
  }

  return map;
}

/**
 * Consecutive days with at least one run, ending today. A streak stays alive
 * until the current day ends, so a run yesterday still counts.
 */
export function currentStreak(activities: ActivitySummary[], now: number): number {
  const days = runsByDay(activities);
  if (days.size === 0) return 0;

  let cursor = startOfDay(now);
  if (!days.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!days.has(cursor)) return 0;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive days anywhere in the history. */
export function longestStreak(activities: ActivitySummary[]): number {
  const days = [...runsByDay(activities).keys()].sort((a, b) => a - b);
  if (days.length === 0) return 0;

  let best = 1;
  let run = 1;

  for (let i = 1; i < days.length; i++) {
    const gap = Math.round((days[i] - days[i - 1]) / DAY_MS);
    run = gap === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  return best;
}

export type DayCell = {
  /** Local midnight of the cell. */
  dayStart: number;
  distanceM: number;
  count: number;
  future: boolean;
};

/**
 * Columns of 7 days (Monday → Sunday), oldest first, ending with the current
 * week. Ready to render as a GitHub-style training heatmap.
 */
export function trainingWeeks(
  activities: ActivitySummary[],
  weeks = 16,
  now: number,
): DayCell[][] {
  const days = runsByDay(activities);
  const thisWeek = startOfWeek(now);
  const first = addDays(thisWeek, -7 * (weeks - 1));
  const columns: DayCell[][] = [];

  for (let w = 0; w < weeks; w++) {
    const column: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dayStart = addDays(first, w * 7 + d);
      const stat = days.get(dayStart);
      column.push({
        dayStart,
        distanceM: stat?.distanceM ?? 0,
        count: stat?.count ?? 0,
        future: dayStart > now,
      });
    }
    columns.push(column);
  }

  return columns;
}

/** Number of separate weeks in which the distance goal was reached. */
export function weeksReachingGoal(
  activities: ActivitySummary[],
  goalM: number,
): number {
  if (goalM <= 0) return 0;

  const perWeek = new Map<number, number>();
  for (const activity of activities) {
    const week = startOfWeek(activity.startedAt);
    perWeek.set(week, (perWeek.get(week) ?? 0) + activity.distanceM);
  }

  let reached = 0;
  for (const distance of perWeek.values()) {
    if (distance >= goalM) reached += 1;
  }
  return reached;
}

export type MonthDay = {
  dayStart: number;
  inMonth: boolean;
  future: boolean;
  distanceM: number;
  count: number;
};

/** Six rows of seven days (Mon → Sun) covering the month containing `monthStart`. */
export function monthWeeks(
  activities: ActivitySummary[],
  monthStart: number,
  now: number,
): MonthDay[][] {
  const days = runsByDay(activities);
  const first = startOfMonth(monthStart);
  const gridStart = startOfWeek(first);
  const rows: MonthDay[][] = [];

  for (let week = 0; week < 6; week++) {
    const row: MonthDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dayStart = addDays(gridStart, week * 7 + d);
      const stat = days.get(dayStart);
      row.push({
        dayStart,
        inMonth: new Date(dayStart).getMonth() === new Date(first).getMonth(),
        future: dayStart > now,
        distanceM: stat?.distanceM ?? 0,
        count: stat?.count ?? 0,
      });
    }
    rows.push(row);
  }

  return rows;
}

export function shiftMonth(ms: number, delta: number): number {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + delta, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
