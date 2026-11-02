import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  type AppSettings,
} from '@/db/settings';

type SettingsContextValue = {
  settings: AppSettings;
  /** False until the stored values have been read once. */
  ready: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stored = await readSettings(db);
        if (!cancelled) setSettings(stored);
      } catch {
        // Keep the defaults if the row is missing or unreadable.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db]);

  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      await writeSettings(db, patch);
    },
    [db],
  );

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings phải nằm trong SettingsProvider');
  return context;
}
