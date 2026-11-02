import { useMemo } from 'react';

import type { ThemeMode } from '@/db/settings';
import { useSettings } from '@/hooks/useSettings';
import { applyAccent, darkColors, lightColors, type Palette } from '@/lib/theme';

export type Theme = {
  mode: ThemeMode;
  colors: Palette;
};

/** Resolves the active palette from settings. */
export function useTheme(): Theme {
  const { settings } = useSettings();
  const mode = settings.theme;
  return useMemo(
    () => ({ mode, colors: mode === 'light' ? lightColors : darkColors }),
    [mode],
  );
}

type Factory<T> = (colors: Palette) => T;

/**
 * Styles are built per palette and cached per factory, so a screen only pays
 * for rebuilding its StyleSheet when the theme actually changes.
 */
const cache = new WeakMap<Factory<unknown>, { key: string; styles: unknown }>();

export function useThemedStyles<T>(factory: Factory<T>): T {
  const { mode, colors } = useTheme();
  const { settings } = useSettings();
  const key = `${mode}:${settings.accentColor ?? ''}`;
  const hit = cache.get(factory);
  if (hit && hit.key === key) return hit.styles as T;

  const styles = factory(colors);
  cache.set(factory, { key, styles });
  return styles;
}
