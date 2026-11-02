import type { SQLiteDatabase } from 'expo-sqlite';

import type { PainArea, RecoveryLog } from '@/lib/recovery';

type RecoveryRow = {
  id: string;
  at: number;
  area: string;
  pain: number;
  note: string;
  created_at: number;
};

function toPainArea(value: string): PainArea {
  const allowed: PainArea[] = ['knee', 'shin', 'achilles', 'foot', 'hip', 'back', 'other'];
  return allowed.includes(value as PainArea) ? (value as PainArea) : 'other';
}

function fromRow(row: RecoveryRow): RecoveryLog {
  return {
    id: row.id,
    at: row.at,
    area: toPainArea(row.area),
    pain: Math.min(5, Math.max(1, Math.round(row.pain))),
    note: row.note ?? '',
    createdAt: row.created_at,
  };
}

export async function listRecoveryLogs(db: SQLiteDatabase): Promise<RecoveryLog[]> {
  const rows = await db.getAllAsync<RecoveryRow>(
    'SELECT * FROM recovery_logs ORDER BY at DESC, created_at DESC',
  );
  return rows.map(fromRow);
}

export async function addRecoveryLog(
  db: SQLiteDatabase,
  input: { at: number; area: PainArea; pain: number; note: string },
): Promise<string> {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await db.runAsync(
    'INSERT INTO recovery_logs (id, at, area, pain, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    input.at,
    input.area,
    Math.min(5, Math.max(1, Math.round(input.pain))),
    input.note.trim().slice(0, 400),
    Date.now(),
  );
  return id;
}

export async function deleteRecoveryLog(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM recovery_logs WHERE id = ?', id);
}
