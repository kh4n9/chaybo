import type { SQLiteDatabase } from 'expo-sqlite';

import { makePreview } from '@/lib/routePath';
import { toRunType } from '@/lib/runType';
import { recomputeAllGear } from './gear';
import type {
  Activity,
  ActivityRow,
  ActivitySummary,
  Feeling,
  RunType,
  Split,
  TrackPoint,
} from '@/lib/types';

const SUMMARY_COLUMNS =
  'id, title, started_at, duration_s, distance_m, avg_pace_s, elev_gain_m, feeling, run_type, notes, tags, preview';

type SummaryRow = {
  id: string;
  title: string;
  started_at: number;
  duration_s: number;
  distance_m: number;
  avg_pace_s: number | null;
  elev_gain_m: number;
  feeling: number | null;
  run_type: string | null;
  notes: string | null;
  tags: string | null;
  preview: string | null;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toFeeling(value: number | null | undefined): Feeling | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 5) return null;
  return rounded as Feeling;
}

function toSummary(row: SummaryRow): ActivitySummary {
  return {
    id: row.id,
    title: row.title,
    startedAt: row.started_at,
    durationS: row.duration_s,
    distanceM: row.distance_m,
    avgPaceS: row.avg_pace_s,
    elevGainM: row.elev_gain_m,
    feeling: toFeeling(row.feeling),
    runType: toRunType(row.run_type),
    notes: row.notes ?? '',
    tags: row.tags ?? '',
    preview: parseJson<TrackPoint[]>(row.preview, []),
  };
}

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    title: row.title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationS: row.duration_s,
    elapsedS: row.elapsed_s,
    distanceM: row.distance_m,
    avgPaceS: row.avg_pace_s,
    bestPaceS: row.best_pace_s,
    elevGainM: row.elev_gain_m,
    calories: row.calories,
    feeling: toFeeling(row.feeling),
    runType: toRunType(row.run_type),
    weather: row.weather ?? null,
    gearId: row.gear_id ?? null,
    favorite: row.favorite === 1,
    notes: row.notes ?? '',
    photos: parseJson<string[]>(row.photos, []),
    tags: row.tags ?? '',
    cadence: row.cadence ?? null,
    avgHr: row.avg_hr ?? null,
    treadmill: row.treadmill === 1,
    route: parseJson<TrackPoint[]>(row.route, []),
    preview: parseJson<TrackPoint[]>(row.preview, []),
    splits: parseJson<Split[]>(row.splits, []),
  };
}

export async function listActivities(db: SQLiteDatabase): Promise<ActivitySummary[]> {
  const rows = await db.getAllAsync<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM activities ORDER BY started_at DESC`,
  );
  return rows.map(toSummary);
}

/** Full activities, route and splits included. Used by export and backup. */
export async function listAllActivities(db: SQLiteDatabase): Promise<Activity[]> {
  const rows = await db.getAllAsync<ActivityRow>(
    'SELECT * FROM activities ORDER BY started_at DESC',
  );
  return rows.map(toActivity);
}

export async function getActivity(db: SQLiteDatabase, id: string): Promise<Activity | null> {
  const row = await db.getFirstAsync<ActivityRow>('SELECT * FROM activities WHERE id = ?', id);
  return row ? toActivity(row) : null;
}

export type SaveActivityInput = Omit<Activity, 'id' | 'title' | 'preview' | 'notes' | 'feeling' | 'runType' | 'weather' | 'gearId' | 'favorite' | 'photos' | 'tags' | 'cadence' | 'avgHr' | 'treadmill'> & {
  id?: string;
  title?: string;
  notes?: string;
  feeling?: Feeling | null;
  runType?: RunType | null;
  weather?: string | null;
  gearId?: string | null;
  favorite?: boolean;
  photos?: string[];
  tags?: string;
  cadence?: number | null;
  avgHr?: number | null;
  treadmill?: boolean;
};

export function newActivityId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveActivity(
  db: SQLiteDatabase,
  input: SaveActivityInput,
): Promise<string> {
  const id = input.id ?? newActivityId();
  const now = Date.now();

  await db.runAsync(
    `INSERT OR REPLACE INTO activities
      (id, title, started_at, ended_at, duration_s, elapsed_s, distance_m,
       avg_pace_s, best_pace_s, elev_gain_m, calories, route, preview, splits,
       notes, feeling, run_type, weather, gear_id, favorite, photos, tags,
       cadence, avg_hr, treadmill, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.title ?? 'Buổi chạy',
    input.startedAt,
    input.endedAt,
    Math.round(input.durationS),
    Math.round(input.elapsedS),
    input.distanceM,
    input.avgPaceS,
    input.bestPaceS,
    input.elevGainM,
    input.calories,
    JSON.stringify(input.route),
    JSON.stringify(makePreview(input.route)),
    JSON.stringify(input.splits),
    input.notes?.slice(0, 2000) ?? '',
    toFeeling(input.feeling),
    toRunType(input.runType),
    input.weather ?? null,
    input.gearId ?? null,
    input.favorite ? 1 : 0,
    JSON.stringify(input.photos ?? []),
    (input.tags ?? '').slice(0, 200),
    input.cadence ?? null,
    input.avgHr ?? null,
    input.treadmill ? 1 : 0,
    now,
  );

  await recomputeAllGear(db);
  return id;
}

export async function updateActivityTitle(
  db: SQLiteDatabase,
  id: string,
  title: string,
): Promise<void> {
  await db.runAsync('UPDATE activities SET title = ? WHERE id = ?', title, id);
}

export async function updateActivityNotes(
  db: SQLiteDatabase,
  id: string,
  notes: string,
  feeling: Feeling | null,
): Promise<void> {
  await db.runAsync(
    'UPDATE activities SET notes = ?, feeling = ? WHERE id = ?',
    notes.slice(0, 2000),
    feeling,
    id,
  );
}

export async function updateActivityRunType(
  db: SQLiteDatabase,
  id: string,
  runType: RunType | null,
): Promise<void> {
  await db.runAsync('UPDATE activities SET run_type = ? WHERE id = ?', toRunType(runType), id);
}

export async function updateActivityGear(
  db: SQLiteDatabase,
  id: string,
  gearId: string | null,
): Promise<void> {
  await db.runAsync('UPDATE activities SET gear_id = ? WHERE id = ?', gearId, id);
}

export async function updateActivityFavorite(
  db: SQLiteDatabase,
  id: string,
  favorite: boolean,
): Promise<void> {
  await db.runAsync('UPDATE activities SET favorite = ? WHERE id = ?', favorite ? 1 : 0, id);
}

export async function updateActivityPhotos(
  db: SQLiteDatabase,
  id: string,
  photos: string[],
): Promise<void> {
  await db.runAsync(
    'UPDATE activities SET photos = ? WHERE id = ?',
    JSON.stringify(photos.slice(0, 12)),
    id,
  );
}

export async function updateActivityTags(
  db: SQLiteDatabase,
  id: string,
  tags: string,
): Promise<void> {
  await db.runAsync('UPDATE activities SET tags = ? WHERE id = ?', tags.slice(0, 200), id);
}

export async function updateActivityAvgHr(
  db: SQLiteDatabase,
  id: string,
  avgHr: number | null,
): Promise<void> {
  await db.runAsync('UPDATE activities SET avg_hr = ? WHERE id = ?', avgHr, id);
}

export async function getPreviousActivity(
  db: SQLiteDatabase,
  beforeMs: number,
): Promise<ActivitySummary | null> {
  const row = await db.getFirstAsync<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM activities WHERE started_at < ? ORDER BY started_at DESC LIMIT 1`,
    beforeMs,
  );
  return row ? toSummary(row) : null;
}

/**
 * Restores activities from a backup. Rows with the same id are replaced, so
 * importing the same file twice does not create duplicates.
 */
export async function restoreActivities(
  db: SQLiteDatabase,
  activities: Activity[],
): Promise<number> {
  await db.withTransactionAsync(async () => {
    for (const activity of activities) {
      await saveActivity(db, activity);
    }
    await recomputeAllGear(db);
  });

  return activities.length;
}

export async function deleteActivity(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM activities WHERE id = ?', id);
  await recomputeAllGear(db);
}

export async function deleteAllActivities(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM activities');
  await recomputeAllGear(db);
}

export async function countActivities(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM activities');
  return row?.n ?? 0;
}
