import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'chaybo.db';
const SCHEMA_VERSION = 10;

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current >= SCHEMA_VERSION) return;

  if (current === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS activities (
        id           TEXT    PRIMARY KEY NOT NULL,
        title        TEXT    NOT NULL,
        started_at   INTEGER NOT NULL,
        ended_at     INTEGER NOT NULL,
        duration_s   INTEGER NOT NULL,
        elapsed_s    INTEGER NOT NULL,
        distance_m   REAL    NOT NULL,
        avg_pace_s   REAL,
        best_pace_s  REAL,
        elev_gain_m  REAL    NOT NULL DEFAULT 0,
        calories     INTEGER NOT NULL DEFAULT 0,
        route        TEXT    NOT NULL,
        preview      TEXT    NOT NULL DEFAULT '[]',
        splits       TEXT    NOT NULL,
        created_at   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_activities_started_at
        ON activities (started_at DESC);
    `);
  }

  if (current < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS gear (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'shoes',
      total_distance_m REAL NOT NULL DEFAULT 0,
      retired INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recovery_logs (
      id TEXT PRIMARY KEY NOT NULL,
      at INTEGER NOT NULL,
      area TEXT NOT NULL,
      pain INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `);

  const alterColumns = [
    "ALTER TABLE activities ADD COLUMN notes TEXT NOT NULL DEFAULT ''",
    'ALTER TABLE activities ADD COLUMN feeling INTEGER',
    'ALTER TABLE activities ADD COLUMN run_type TEXT',
    'ALTER TABLE activities ADD COLUMN weather TEXT',
    'ALTER TABLE activities ADD COLUMN gear_id TEXT',
    'ALTER TABLE activities ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE activities ADD COLUMN photos TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE activities ADD COLUMN tags TEXT NOT NULL DEFAULT ''",
  ];

  for (const sql of alterColumns) {
    try {
      await db.execAsync(sql);
    } catch {
      // Column already exists (or another issue); ignore.
    }
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}