import {
  DEFAULT_SETTINGS,
  FREEZE_RANGE,
  GOAL_RANGE,
  MONTH_GOAL_RANGE,
  WEIGHT_RANGE,
  YEAR_GOAL_RANGE,
  type AppSettings,
} from '@/db/settings';
import { elevationGain, estimateCalories, totalDistance } from './geo';
import { makePreview } from './routePath';
import { toRunType } from './runType';
import { bestPaceFromSplits, computeSplits } from './splits';
import { toPlanGoal, toPlanLevel } from './trainingPlan';
import type { Activity, Feeling, Split, TrackPoint } from './types';

export type BackupFile = {
  app: 'chaybo';
  format: 1;
  exportedAt: string;
  settings: AppSettings;
  activities: Activity[];
};

/** Human-readable JSON snapshot: settings plus every run with its full route. */
export function buildBackup(activities: Activity[], settings: AppSettings): string {
  const backup: BackupFile = {
    app: 'chaybo',
    format: 1,
    exportedAt: new Date().toISOString(),
    settings,
    activities,
  };
  return JSON.stringify(backup, null, 2);
}

/** Raised when a picked file is not a readable chaybo backup. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export type RestoredBackup = {
  /** `null` when the file has no usable settings block. */
  settings: AppSettings | null;
  activities: Activity[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeSettings(value: unknown): AppSettings | null {
  if (!isRecord(value)) return null;

  const weightKg = finiteNumber(value.weightKg);
  const weeklyGoalKm = finiteNumber(value.weeklyGoalKm);
  const lastBackupAt = finiteNumber(value.lastBackupAt);
  if (weightKg == null && weeklyGoalKm == null) return null;

  const units = value.units === 'mi' ? 'mi' : 'km';
  const theme = value.theme === 'light' ? 'light' : 'dark';

  return {
    weightKg: clamp(weightKg ?? DEFAULT_SETTINGS.weightKg, WEIGHT_RANGE.min, WEIGHT_RANGE.max),
    weeklyGoalKm: clamp(
      weeklyGoalKm ?? DEFAULT_SETTINGS.weeklyGoalKm,
      GOAL_RANGE.min,
      GOAL_RANGE.max,
    ),
    monthlyGoalKm: clamp(
      finiteNumber(value.monthlyGoalKm) ?? DEFAULT_SETTINGS.monthlyGoalKm,
      MONTH_GOAL_RANGE.min,
      MONTH_GOAL_RANGE.max,
    ),
    yearlyGoalKm: clamp(
      finiteNumber(value.yearlyGoalKm) ?? DEFAULT_SETTINGS.yearlyGoalKm,
      YEAR_GOAL_RANGE.min,
      YEAR_GOAL_RANGE.max,
    ),
    lastBackupAt: Math.max(0, lastBackupAt ?? DEFAULT_SETTINGS.lastBackupAt),
    units,
    theme,
    streakFreezes: clamp(
      finiteNumber(value.streakFreezes) ?? DEFAULT_SETTINGS.streakFreezes,
      FREEZE_RANGE.min,
      FREEZE_RANGE.max,
    ),
    planGoal: toPlanGoal(value.planGoal),
    planLevel: toPlanLevel(value.planLevel),
    planStartAt: Math.max(0, finiteNumber(value.planStartAt) ?? DEFAULT_SETTINGS.planStartAt),
    voiceCoach: value.voiceCoach === true || value.voiceCoach === 'true' || value.voiceCoach === 1 || value.voiceCoach === '1',
    autoPauseSeconds: clamp(
      finiteNumber(value.autoPauseSeconds) ?? DEFAULT_SETTINGS.autoPauseSeconds,
      0,
      120,
    ),
    biometricLock: value.biometricLock === true || value.biometricLock === 'true' || value.biometricLock === 1 || value.biometricLock === '1',
  };
}

function sanitizePoint(value: unknown): TrackPoint | null {
  if (!isRecord(value)) return null;

  const lat = finiteNumber(value.lat);
  const lng = finiteNumber(value.lng);
  const t = finiteNumber(value.t);
  if (lat == null || lng == null || t == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng, alt: finiteNumber(value.alt), t };
}

function sanitizeFeeling(value: unknown): Feeling | null {
  const n = finiteNumber(value);
  if (n == null) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 5 ? (rounded as Feeling) : null;
}

function sanitizeSplit(value: unknown): Split | null {
  if (!isRecord(value)) return null;

  const km = finiteNumber(value.km);
  const distanceM = finiteNumber(value.distanceM);
  const durationS = finiteNumber(value.durationS);
  const paceSPerKm = finiteNumber(value.paceSPerKm);
  if (km == null || distanceM == null || durationS == null || paceSPerKm == null) return null;

  return {
    km,
    distanceM,
    durationS,
    paceSPerKm,
    elevGainM: finiteNumber(value.elevGainM) ?? 0,
  };
}

/**
 * Rebuilds one activity from a backup entry, tolerating older or hand-edited
 * files: route points, splits and derived stats are recomputed when missing.
 */
function sanitizeActivity(value: unknown, weightKg: number): Activity | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' && value.id.trim().length > 0 ? value.id.trim() : null;
  const startedAt = finiteNumber(value.startedAt);
  if (id == null || startedAt == null) return null;

  const route = Array.isArray(value.route)
    ? value.route.map(sanitizePoint).filter((point): point is TrackPoint => point !== null)
    : [];

  const endedAt = finiteNumber(value.endedAt) ?? route[route.length - 1]?.t ?? startedAt;
  const durationS = Math.max(0, finiteNumber(value.durationS) ?? (endedAt - startedAt) / 1000);
  const elapsedS = Math.max(0, finiteNumber(value.elapsedS) ?? durationS);
  const distanceM = Math.max(0, finiteNumber(value.distanceM) ?? totalDistance(route));

  const storedSplits = Array.isArray(value.splits)
    ? value.splits.map(sanitizeSplit).filter((split): split is Split => split !== null)
    : [];
  const splits = storedSplits.length > 0 ? storedSplits : computeSplits(route);

  const avgPaceS =
    finiteNumber(value.avgPaceS) ?? (distanceM > 0 ? (durationS / distanceM) * 1000 : null);
  const bestPaceS = finiteNumber(value.bestPaceS) ?? bestPaceFromSplits(splits);

  const title =
    typeof value.title === 'string' && value.title.trim().length > 0
      ? value.title.trim().slice(0, 60)
      : 'Buổi chạy';

  const notes = typeof value.notes === 'string' ? value.notes.slice(0, 2000) : '';

  return {
    id,
    title,
    startedAt,
    endedAt,
    durationS,
    elapsedS,
    distanceM,
    avgPaceS: avgPaceS != null && avgPaceS > 0 ? avgPaceS : null,
    bestPaceS: bestPaceS != null && bestPaceS > 0 ? bestPaceS : null,
    elevGainM: Math.max(0, finiteNumber(value.elevGainM) ?? elevationGain(route)),
    calories: Math.max(0, finiteNumber(value.calories) ?? estimateCalories(distanceM, weightKg)),
    feeling: sanitizeFeeling(value.feeling),
    runType: toRunType(value.runType),
    weather: typeof value.weather === 'string' ? value.weather.slice(0, 80) : null,
    gearId: null,
    favorite: false,
    notes,
    route,
    preview: makePreview(route),
    splits,
  };
}

/**
 * Parses a `.json` backup produced by `buildBackup`.
 * Throws `BackupError` with a Vietnamese message when the file is unusable.
 */
export function parseBackup(text: string): RestoredBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Tệp không phải JSON hợp lệ.');
  }

  if (!isRecord(raw)) throw new BackupError('Nội dung tệp không đúng định dạng sao lưu.');
  if (raw.app !== 'chaybo') throw new BackupError('Đây không phải tệp sao lưu của chaybo.');
  if (raw.format !== 1) throw new BackupError('Phiên bản sao lưu này chưa được hỗ trợ.');
  if (!Array.isArray(raw.activities)) {
    throw new BackupError('Tệp sao lưu thiếu danh sách buổi chạy.');
  }

  const settings = sanitizeSettings(raw.settings);
  const weightKg = settings?.weightKg ?? DEFAULT_SETTINGS.weightKg;

  const activities = raw.activities
    .map((entry) => sanitizeActivity(entry, weightKg))
    .filter((activity): activity is Activity => activity !== null);

  if (activities.length === 0 && raw.activities.length > 0) {
    throw new BackupError('Không đọc được buổi chạy nào trong tệp.');
  }

  return { settings, activities };
}
