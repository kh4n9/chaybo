import type { SQLiteDatabase } from 'expo-sqlite';

export type Gear = {
  id: string;
  name: string;
  type: string;
  totalDistanceM: number;
  retired: boolean;
  createdAt: number;
};

export async function listGear(db: SQLiteDatabase): Promise<Gear[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    type: string;
    total_distance_m: number;
    retired: number;
    created_at: number;
  }>('SELECT * FROM gear ORDER BY created_at DESC');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    totalDistanceM: row.total_distance_m,
    retired: row.retired === 1,
    createdAt: row.created_at,
  }));
}

export async function saveGear(db: SQLiteDatabase, name: string, type = 'shoes'): Promise<string> {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await db.runAsync(
    'INSERT INTO gear (id, name, type, total_distance_m, retired, created_at) VALUES (?, ?, ?, 0, 0, ?)',
    id,
    name.trim().slice(0, 60),
    type,
    Date.now(),
  );
  return id;
}

export async function deleteGear(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM gear WHERE id = ?', id);
  await db.runAsync('UPDATE activities SET gear_id = NULL WHERE gear_id = ?', id);
}

export async function gearById(db: SQLiteDatabase, id: string): Promise<Gear | null> {
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    type: string;
    total_distance_m: number;
    retired: number;
    created_at: number;
  }>('SELECT * FROM gear WHERE id = ?', id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    totalDistanceM: row.total_distance_m,
    retired: row.retired === 1,
    createdAt: row.created_at,
  };
}

export async function recomputeGearDistance(db: SQLiteDatabase, gearId: string): Promise<void> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT COALESCE(SUM(distance_m), 0) AS total FROM activities WHERE gear_id = ?',
    gearId,
  );
  await db.runAsync('UPDATE gear SET total_distance_m = ? WHERE id = ?', row?.total ?? 0, gearId);
}

export async function recomputeAllGear(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM gear');
  for (const row of rows) {
    await recomputeGearDistance(db, row.id);
  }
}