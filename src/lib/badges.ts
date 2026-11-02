import { currentStreak, longestStreak, weeksReachingGoal } from './calendar';
import { startOfMonth } from './format';
import type { ActivitySummary } from './types';

export type BadgeUnit = 'buổi' | 'km' | 'm' | 'ngày' | 'lần' | 'tuần';

export type Badge = {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  current: number;
  target: number;
  unit: BadgeUnit;
};

function maxMonthlyDistanceKm(activities: ActivitySummary[]): number {
  const months = new Map<number, number>();
  for (const activity of activities) {
    const month = startOfMonth(activity.startedAt);
    months.set(month, (months.get(month) ?? 0) + activity.distanceM);
  }

  let max = 0;
  for (const distance of months.values()) {
    if (distance > max) max = distance;
  }
  return max / 1000;
}

/**
 * Offline achievements. Every badge is derived from stored runs, so it is
 * deterministic and needs no server. The catalogue contains ~500 badges that
 * reward consistent, long-term running.
 */
export function buildBadges(
  activities: ActivitySummary[],
  weeklyGoalKm: number,
  now: number,
): Badge[] {
  const count = activities.length;
  const distanceKm = activities.reduce((sum, a) => sum + a.distanceM, 0) / 1000;
  const elevationM = activities.reduce((sum, a) => sum + a.elevGainM, 0);
  const longestKm =
    activities.reduce((max, a) => Math.max(max, a.distanceM), 0) / 1000;
  const streak = Math.max(currentStreak(activities, now), longestStreak(activities));
  const earlyRuns = activities.filter((a) => new Date(a.startedAt).getHours() < 6).length;
  const nightRuns = activities.filter((a) => new Date(a.startedAt).getHours() >= 21).length;
  const goalWeeks = weeksReachingGoal(activities, weeklyGoalKm * 1000);
  const bestMonthKm = maxMonthlyDistanceKm(activities);

  const badge = (
    id: string,
    title: string,
    description: string,
    current: number,
    target: number,
    unit: BadgeUnit,
  ): Badge => ({
    id,
    title,
    description,
    current,
    target,
    unit,
    earned: current >= target,
  });

  const list: Badge[] = [];

  for (let t = 1; t <= 100; t++) {
    list.push(
      badge(`run_${t}`, `Buổi chạy ${t}`, `Hoàn thành ${t} buổi chạy`, count, t, 'buổi'),
    );
  }

  for (let t = 1; t <= 150; t++) {
    list.push(
      badge(`dist_${t}`, `Tích luỹ ${t} km`, `Tích luỹ ${t} km tổng`, distanceKm, t, 'km'),
    );
  }

  for (let t = 1; t <= 40; t++) {
    list.push(
      badge(`long_${t}`, `Chặng ${t} km`, `Một buổi chạy từ ${t} km`, longestKm, t, 'km'),
    );
  }

  for (let t = 1; t <= 80; t++) {
    list.push(
      badge(`streak_${t}`, `Chuỗi ${t} ngày`, `Chạy ${t} ngày liên tiếp`, streak, t, 'ngày'),
    );
  }

  for (let t = 100; t <= 4000; t += 100) {
    list.push(
      badge(`climb_${t}`, `Leo ${t} m`, `Tích luỹ ${t} m leo dốc`, elevationM, t, 'm'),
    );
  }

  for (let t = 1; t <= 20; t++) {
    list.push(
      badge(`early_${t}`, `Chim sớm ${t}`, `Chạy ${t} buổi trước 6 giờ sáng`, earlyRuns, t, 'lần'),
    );
  }

  for (let t = 1; t <= 20; t++) {
    list.push(
      badge(`night_${t}`, `Cú đêm ${t}`, `Chạy ${t} buổi sau 21 giờ`, nightRuns, t, 'lần'),
    );
  }

  for (let t = 1; t <= 20; t++) {
    list.push(
      badge(
        `goal_${t}`,
        `Mục tiêu ${t} tuần`,
        `Đạt mục tiêu tuần ${t} lần`,
        goalWeeks,
        t,
        'tuần',
      ),
    );
  }

  for (let t = 1; t <= 30; t++) {
    list.push(
      badge(
        `month_${t * 10}`,
        `Tháng ${t * 10} km`,
        `Chạy ${t * 10} km trong một tháng`,
        bestMonthKm,
        t * 10,
        'km',
      ),
    );
  }

  return list.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    const ratioA = Math.min(1, a.current / a.target);
    const ratioB = Math.min(1, b.current / b.target);
    return ratioB - ratioA;
  });
}

export function earnedCount(badges: Badge[]): number {
  return badges.filter((badge) => badge.earned).length;
}