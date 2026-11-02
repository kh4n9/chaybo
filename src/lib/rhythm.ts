import type { ActivitySummary } from './types';

export type WeekdayStat = {
  /** 0 = Monday … 6 = Sunday */
  index: number;
  label: string;
  count: number;
  distanceM: number;
};

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function weekdayStats(activities: ActivitySummary[]): WeekdayStat[] {
  const stats = WEEKDAY_LABELS.map((label, index) => ({
    index,
    label,
    count: 0,
    distanceM: 0,
  }));

  for (const activity of activities) {
    const day = new Date(activity.startedAt).getDay(); // 0 Sun … 6 Sat
    const index = (day + 6) % 7; // Monday = 0
    const stat = stats[index];
    stat.count += 1;
    stat.distanceM += activity.distanceM;
  }

  return stats;
}

export type TimeBucketKey = 'morning' | 'noon' | 'afternoon' | 'evening';

export type TimeBucket = {
  key: TimeBucketKey;
  label: string;
  range: string;
  count: number;
  distanceM: number;
};

export const TIME_BUCKETS: TimeBucket[] = [
  { key: 'morning', label: 'Buổi sáng', range: '5:00–11:00', count: 0, distanceM: 0 },
  { key: 'noon', label: 'Buổi trưa', range: '11:00–14:00', count: 0, distanceM: 0 },
  { key: 'afternoon', label: 'Buổi chiều', range: '14:00–18:00', count: 0, distanceM: 0 },
  { key: 'evening', label: 'Buổi tối', range: '18:00+', count: 0, distanceM: 0 },
];

function bucketForHour(hour: number): TimeBucketKey {
  if (hour < 11) return 'morning';
  if (hour < 14) return 'noon';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function timeOfDayStats(activities: ActivitySummary[]): TimeBucket[] {
  const stats = TIME_BUCKETS.map((bucket) => ({ ...bucket }));
  for (const activity of activities) {
    const hour = new Date(activity.startedAt).getHours();
    const key = bucketForHour(hour);
    const stat = stats.find((item) => item.key === key);
    if (stat) {
      stat.count += 1;
      stat.distanceM += activity.distanceM;
    }
  }
  return stats;
}

export function favouriteWeekday(stats: WeekdayStat[]): WeekdayStat | null {
  if (stats.length === 0) return null;
  return stats.reduce((best, current) =>
    current.count > best.count ? current : best,
  );
}

export function favouriteTimeBucket(stats: TimeBucket[]): TimeBucket | null {
  if (stats.length === 0) return null;
  return stats.reduce((best, current) =>
    current.count > best.count ? current : best,
  );
}

