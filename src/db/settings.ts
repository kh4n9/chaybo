import type { SQLiteDatabase } from 'expo-sqlite';

import { toPlanGoal, toPlanLevel, type PlanGoal, type PlanLevel } from '@/lib/trainingPlan';

export type Units = 'km' | 'mi';
export type ThemeMode = 'dark' | 'light';

export type AppSettings = {
  /** Body weight in kilograms, used to estimate calories. */
  weightKg: number;
  /** Weekly distance goal in kilometres. `0` turns the goal off. */
  weeklyGoalKm: number;
  /** Monthly distance goal in kilometres. `0` turns the goal off. */
  monthlyGoalKm: number;
  /** Yearly distance goal in kilometres. `0` turns the goal off. */
  yearlyGoalKm: number;
  /** Epoch ms of the last successful JSON backup. `0` means never. */
  lastBackupAt: number;
  /** Preferred distance unit. */
  units: Units;
  /** Preferred colour scheme. */
  theme: ThemeMode;
  /** Number of missed days a streak can survive. */
  streakFreezes: number;
  /** Race distance the training plan is built for. */
  planGoal: PlanGoal;
  /** Experience level of the training plan. */
  planLevel: PlanLevel;
  /** Epoch ms of the plan's first Monday. `0` means not configured. */
  planStartAt: number;
  /** Speak distance/pace milestones aloud while recording. */
  voiceCoach: boolean;
  /** Auto-pause recording after this many seconds stationary (0 = off). */
  autoPauseSeconds: number;
  /** Require Face ID / Touch ID to open the app. */
  biometricLock: boolean;
  /** Whether the first-run onboarding has been dismissed. */
  onboarded: boolean;
  /** Custom accent colour (hex, empty = default lime). */
  accentColor: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  weightKg: 62,
  weeklyGoalKm: 20,
  monthlyGoalKm: 80,
  yearlyGoalKm: 900,
  lastBackupAt: 0,
  units: 'km',
  theme: 'dark',
  streakFreezes: 2,
  planGoal: '10k',
  planLevel: 'beginner',
  planStartAt: 0,
  voiceCoach: false,
  autoPauseSeconds: 20,
  biometricLock: false,
  onboarded: false,
  accentColor: '',
};

export const WEIGHT_RANGE = { min: 35, max: 160 } as const;
export const GOAL_RANGE = { min: 0, max: 300 } as const;
export const MONTH_GOAL_RANGE = { min: 0, max: 1200 } as const;
export const YEAR_GOAL_RANGE = { min: 0, max: 15000 } as const;
export const FREEZE_RANGE = { min: 0, max: 5 } as const;

/** Setting key stored in the `settings` table. */
const COLUMN: Record<keyof AppSettings, string> = {
  weightKg: 'weight_kg',
  weeklyGoalKm: 'weekly_goal_km',
  monthlyGoalKm: 'monthly_goal_km',
  yearlyGoalKm: 'yearly_goal_km',
  lastBackupAt: 'last_backup_at',
  units: 'units',
  theme: 'theme',
  streakFreezes: 'streak_freezes',
  planGoal: 'plan_goal',
  planLevel: 'plan_level',
  planStartAt: 'plan_start_at',
  voiceCoach: 'voice_coach',
  autoPauseSeconds: 'auto_pause_seconds',
  biometricLock: 'biometric_lock',
  onboarded: 'onboarded',
  accentColor: 'accent_color',
};

function numberFrom(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export async function readSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings',
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    weightKg: numberFrom(
      values.get(COLUMN.weightKg),
      DEFAULT_SETTINGS.weightKg,
      WEIGHT_RANGE.min,
      WEIGHT_RANGE.max,
    ),
    weeklyGoalKm: numberFrom(
      values.get(COLUMN.weeklyGoalKm),
      DEFAULT_SETTINGS.weeklyGoalKm,
      GOAL_RANGE.min,
      GOAL_RANGE.max,
    ),
    monthlyGoalKm: numberFrom(
      values.get(COLUMN.monthlyGoalKm),
      DEFAULT_SETTINGS.monthlyGoalKm,
      MONTH_GOAL_RANGE.min,
      MONTH_GOAL_RANGE.max,
    ),
    yearlyGoalKm: numberFrom(
      values.get(COLUMN.yearlyGoalKm),
      DEFAULT_SETTINGS.yearlyGoalKm,
      YEAR_GOAL_RANGE.min,
      YEAR_GOAL_RANGE.max,
    ),
    lastBackupAt: numberFrom(
      values.get(COLUMN.lastBackupAt),
      DEFAULT_SETTINGS.lastBackupAt,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    units: values.get(COLUMN.units) === 'mi' ? 'mi' : 'km',
    theme: values.get(COLUMN.theme) === 'light' ? 'light' : 'dark',
    streakFreezes: numberFrom(
      values.get(COLUMN.streakFreezes),
      DEFAULT_SETTINGS.streakFreezes,
      FREEZE_RANGE.min,
      FREEZE_RANGE.max,
    ),
    planGoal: toPlanGoal(values.get(COLUMN.planGoal)),
    planLevel: toPlanLevel(values.get(COLUMN.planLevel)),
    planStartAt: numberFrom(
      values.get(COLUMN.planStartAt),
      DEFAULT_SETTINGS.planStartAt,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    voiceCoach:
      values.get(COLUMN.voiceCoach) === '1' ||
      values.get(COLUMN.voiceCoach) === 'true',
    autoPauseSeconds: numberFrom(
      values.get(COLUMN.autoPauseSeconds),
      DEFAULT_SETTINGS.autoPauseSeconds,
      0,
      120,
    ),
    biometricLock:
      values.get(COLUMN.biometricLock) === '1' ||
      values.get(COLUMN.biometricLock) === 'true',
    onboarded:
      values.get(COLUMN.onboarded) === '1' ||
      values.get(COLUMN.onboarded) === 'true',
    accentColor: values.get(COLUMN.accentColor) ?? '',
  };
}

export async function writeSettings(
  db: SQLiteDatabase,
  patch: Partial<AppSettings>,
): Promise<void> {
  const entries = Object.entries(patch) as [keyof AppSettings, AppSettings[keyof AppSettings]][];
  for (const [key, value] of entries) {
    if (value == null) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    await db.runAsync(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      COLUMN[key],
      String(value),
    );
  }
}
