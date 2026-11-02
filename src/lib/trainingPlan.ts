import { addDays } from './calendar';
import { startOfDay, startOfWeek } from './format';
import type { ActivitySummary } from './types';

export type PlanGoal = '5k' | '10k' | 'half' | 'marathon';
export type PlanLevel = 'beginner' | 'intermediate' | 'advanced';
export type SessionKind = 'easy' | 'interval' | 'tempo' | 'long' | 'race';

export type PlanSession = {
  key: string;
  /** 1-based week index. */
  week: number;
  /** 0 = Monday … 6 = Sunday. */
  day: number;
  dateMs: number;
  kind: SessionKind;
  title: string;
  distanceKm: number;
  detail: string;
};

export type TrainingPlan = {
  goal: PlanGoal;
  level: PlanLevel;
  startMs: number;
  weeks: number;
  sessions: PlanSession[];
  /** Total planned kilometres per week, index 0 = week 1. */
  weeklyKm: number[];
  totalKm: number;
  peakWeekKm: number;
};

type GoalSpec = {
  key: PlanGoal;
  label: string;
  short: string;
  weeks: number;
  raceKm: number;
  base: Record<PlanLevel, number>;
};

export const PLAN_GOALS: GoalSpec[] = [
  {
    key: '5k',
    label: '5 km',
    short: '5K',
    weeks: 8,
    raceKm: 5,
    base: { beginner: 14, intermediate: 24, advanced: 38 },
  },
  {
    key: '10k',
    label: '10 km',
    short: '10K',
    weeks: 10,
    raceKm: 10,
    base: { beginner: 18, intermediate: 30, advanced: 48 },
  },
  {
    key: 'half',
    label: 'Bán marathon',
    short: '21K',
    weeks: 12,
    raceKm: 21.1,
    base: { beginner: 24, intermediate: 38, advanced: 58 },
  },
  {
    key: 'marathon',
    label: 'Marathon',
    short: '42K',
    weeks: 16,
    raceKm: 42.2,
    base: { beginner: 32, intermediate: 50, advanced: 74 },
  },
];

export const PLAN_LEVELS: { key: PlanLevel; label: string; hint: string }[] = [
  { key: 'beginner', label: 'Mới bắt đầu', hint: '3 buổi / tuần' },
  { key: 'intermediate', label: 'Trung bình', hint: '4 buổi / tuần' },
  { key: 'advanced', label: 'Nâng cao', hint: '5 buổi / tuần' },
];

type Template = { kind: SessionKind; share: number; title: string; detail: string };

const TEMPLATES: Record<PlanLevel, Template[]> = {
  beginner: [
    {
      kind: 'easy',
      share: 0.25,
      title: 'Chạy nhẹ',
      detail: 'Pace trò chuyện được, thở đều bằng mũi',
    },
    {
      kind: 'easy',
      share: 0.25,
      title: 'Chạy nhẹ',
      detail: 'Giữ nhịp thoải mái, không cố tốc độ',
    },
    {
      kind: 'long',
      share: 0.5,
      title: 'Chạy dài',
      detail: 'Chậm hơn pace mục tiêu 30–45 giây mỗi km',
    },
  ],
  intermediate: [
    {
      kind: 'easy',
      share: 0.2,
      title: 'Chạy nhẹ',
      detail: 'Khởi động 10 phút, giữ pace dễ chịu',
    },
    {
      kind: 'interval',
      share: 0.18,
      title: 'Biến tốc',
      detail: '6 × 400 m nhanh, nghỉ 90 giây giữa các hiệp',
    },
    {
      kind: 'tempo',
      share: 0.2,
      title: 'Tempo',
      detail: '20 phút ở pace “thoải mái khó”',
    },
    {
      kind: 'long',
      share: 0.42,
      title: 'Chạy dài',
      detail: 'Xây sức bền, giữ nhịp đều cả buổi',
    },
  ],
  advanced: [
    {
      kind: 'easy',
      share: 0.18,
      title: 'Chạy nhẹ',
      detail: 'Buổi hồi phục, pace rất dễ chịu',
    },
    {
      kind: 'interval',
      share: 0.18,
      title: 'Biến tốc',
      detail: '5 × 1 km ở pace 5K, nghỉ 2 phút',
    },
    {
      kind: 'tempo',
      share: 0.18,
      title: 'Tempo',
      detail: '3 × 8 phút tempo, nghỉ 2 phút',
    },
    {
      kind: 'easy',
      share: 0.16,
      title: 'Chạy nhẹ',
      detail: 'Giữ chân, thả lỏng, chú ý kỹ thuật',
    },
    {
      kind: 'long',
      share: 0.3,
      title: 'Chạy dài',
      detail: 'Buổi dài nhất tuần, chậm và đều',
    },
  ],
};

export function toPlanGoal(value: unknown): PlanGoal {
  return value === '10k' || value === 'half' || value === 'marathon' ? value : '5k';
}

export function toPlanLevel(value: unknown): PlanLevel {
  return value === 'intermediate' || value === 'advanced' ? value : 'beginner';
}

export function planGoalLabel(goal: PlanGoal): string {
  return PLAN_GOALS.find((item) => item.key === goal)?.label ?? '5 km';
}

function weeklyTargets(goal: PlanGoal, level: PlanLevel): number[] {
  const spec = PLAN_GOALS.find((item) => item.key === goal) ?? PLAN_GOALS[0];
  const base = spec.base[level];
  const taperWeeks = goal === 'half' || goal === 'marathon' ? 3 : 2;
  const buildWeeks = Math.max(2, spec.weeks - taperWeeks);

  const targets: number[] = [];
  for (let week = 1; week <= buildWeeks; week++) {
    const cutback = week % 4 === 0;
    const factor = (1 + 0.07 * (week - 1)) * (cutback ? 0.75 : 1);
    targets.push(Math.round(base * factor * 2) / 2);
  }

  const lastBuild = targets[targets.length - 1] ?? base;
  const taperFactors = goal === 'half' || goal === 'marathon' ? [0.75, 0.6, 0.45] : [0.65, 0.45];
  for (const factor of taperFactors) {
    targets.push(Math.round(lastBuild * factor * 2) / 2);
  }

  return targets.slice(0, spec.weeks);
}

/**
 * Builds a deterministic week-by-week plan. Dates are anchored to the Monday of
 * the week containing `startAt`, so the runner can start any day.
 */
export function buildTrainingPlan(
  goal: PlanGoal,
  level: PlanLevel,
  startAt: number,
): TrainingPlan {
  const spec = PLAN_GOALS.find((item) => item.key === goal) ?? PLAN_GOALS[0];
  const startMs = startOfWeek(startAt);
  const weeklyKm = weeklyTargets(goal, level);
  const template = TEMPLATES[level];
  const sessions: PlanSession[] = [];

  for (let week = 1; week <= spec.weeks; week++) {
    const total = weeklyKm[week - 1] ?? spec.base[level];
    const isRaceWeek = week === spec.weeks;
    const weekStart = addDays(startMs, (week - 1) * 7);

    if (isRaceWeek) {
      sessions.push({
        key: `w${week}-d1`,
        week,
        day: 1,
        dateMs: addDays(weekStart, 1),
        kind: 'easy',
        title: 'Chạy mở chân',
        distanceKm: Math.max(3, Math.round(total * 0.25 * 2) / 2),
        detail: 'Ngắn, nhẹ, không cố sức trước ngày thi',
      });
      sessions.push({
        key: `w${week}-d3`,
        week,
        day: 3,
        dateMs: addDays(weekStart, 3),
        kind: 'easy',
        title: 'Khởi động nhẹ',
        distanceKm: Math.max(2, Math.round(total * 0.15 * 2) / 2),
        detail: '10 phút chạy + 4 lần chạy nước rút 20 giây',
      });
      sessions.push({
        key: `w${week}-race`,
        week,
        day: 6,
        dateMs: addDays(weekStart, 6),
        kind: 'race',
        title: `Ngày thi ${spec.short}`,
        distanceKm: spec.raceKm,
        detail: 'Khởi động kỹ, chia đều sức, về đích an toàn',
      });
      continue;
    }

    let totalShare = template.reduce((sum, item) => sum + item.share, 0);
    if (totalShare <= 0) totalShare = 1;

    template.forEach((item, index) => {
      const distanceKm = Math.max(2, Math.round((total * item.share) * 2) / 2);
      sessions.push({
        key: `w${week}-d${index}`,
        week,
        day: index,
        dateMs: addDays(weekStart, index),
        kind: item.kind,
        title: item.title,
        distanceKm,
        detail: item.detail,
      });
    });
  }

  const totalKm = sessions.reduce((sum, session) => sum + session.distanceKm, 0);
  const peakWeekKm = weeklyKm.reduce((max, value) => Math.max(max, value), 0);

  return {
    goal,
    level,
    startMs,
    weeks: spec.weeks,
    sessions,
    weeklyKm,
    totalKm,
    peakWeekKm,
  };
}

/**
 * Keys of the planned sessions that have a matching run on the same local day.
 * A run counts when it covers at least 60% of the planned distance.
 */
export function completedSessionKeys(
  plan: TrainingPlan,
  activities: ActivitySummary[],
): Set<string> {
  const byDay = new Map<number, ActivitySummary[]>();
  for (const activity of activities) {
    const day = startOfDay(activity.startedAt);
    const list = byDay.get(day);
    if (list) list.push(activity);
    else byDay.set(day, [activity]);
  }

  const done = new Set<string>();
  for (const session of plan.sessions) {
    const runs = byDay.get(startOfDay(session.dateMs)) ?? [];
    const minimum = Math.max(1000, session.distanceKm * 1000 * 0.6);
    if (runs.some((run) => run.distanceM >= minimum)) done.add(session.key);
  }
  return done;
}

export type PlanProgress = {
  currentWeek: number;
  completedSessions: number;
  totalSessions: number;
  completedKm: number;
  plannedKm: number;
  nextSession: PlanSession | null;
  weekSessions: PlanSession[];
  finished: boolean;
};

/** Matches planned sessions with stored runs by local calendar day. */
export function planProgress(
  plan: TrainingPlan,
  activities: ActivitySummary[],
  now: number,
): PlanProgress {
  const byDay = new Map<number, ActivitySummary[]>();
  for (const activity of activities) {
    const day = startOfDay(activity.startedAt);
    const list = byDay.get(day);
    if (list) list.push(activity);
    else byDay.set(day, [activity]);
  }

  let completedSessions = 0;
  let completedKm = 0;
  for (const session of plan.sessions) {
    const runs = byDay.get(startOfDay(session.dateMs)) ?? [];
    const minimum = Math.max(1000, session.distanceKm * 1000 * 0.6);
    const matched = runs.find((run) => run.distanceM >= minimum);
    if (matched) {
      completedSessions += 1;
      completedKm += matched.distanceM;
    }
  }

  const today = startOfDay(now);
  const weekIndex = Math.floor((today - startOfDay(plan.startMs)) / 604800000) + 1;
  const currentWeek = Math.min(plan.weeks, Math.max(1, weekIndex));

  const nextSession =
    plan.sessions.find((session) => startOfDay(session.dateMs) >= today) ?? null;

  return {
    currentWeek,
    completedSessions,
    totalSessions: plan.sessions.length,
    completedKm,
    plannedKm: plan.totalKm * 1000,
    nextSession,
    weekSessions: plan.sessions.filter((session) => session.week === currentWeek),
    finished: today > addDays(plan.startMs, plan.weeks * 7),
  };
}

export function sessionKindLabel(kind: SessionKind): string {
  switch (kind) {
    case 'easy':
      return 'Nhẹ';
    case 'interval':
      return 'Biến tốc';
    case 'tempo':
      return 'Tempo';
    case 'long':
      return 'Dài';
    case 'race':
      return 'Thi đấu';
  }
}
