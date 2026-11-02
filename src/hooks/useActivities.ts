import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listActivities } from '@/db/activities';
import type { ActivitySummary } from '@/lib/types';

export function useActivities() {
  const db = useSQLiteContext();
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  /** Timestamp of the last successful load, used for "this week" style stats. */
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const rows = await listActivities(db);
    setActivities(rows);
    setFetchedAt(Date.now());
    setLoading(false);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { activities, loading, refresh, fetchedAt };
}
