import { Platform, TextStyle } from 'react-native';

/**
 * Every colour the app paints with. A palette is resolved at render time by
 * `useTheme()`, so screens must build their styles through `useThemedStyles()`
 * instead of calling `StyleSheet.create` at module scope.
 */
export type Palette = {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;

  text: string;
  textDim: string;
  textFaint: string;

  /** Foreground accent: readable as text, icon or 1 px line on `bg`. */
  accent: string;
  /** Vivid accent for filled areas: buttons, progress bars, rings. */
  accentFill: string;
  /** Text/icon colour on top of `accentFill`. */
  onAccent: string;
  accentSoft: string;
  accentLine: string;

  danger: string;
  dangerSoft: string;

  mapOverlay: string;

  /** Matches the status bar to the palette. */
  statusBar: 'light' | 'dark';
};

export const darkColors: Palette = {
  bg: '#08090A',
  bgElevated: '#0E0F11',
  surface: '#141518',
  surfaceAlt: '#1B1D21',
  border: '#24262B',
  borderStrong: '#33363D',

  text: '#F7F8F9',
  textDim: '#9AA0A8',
  textFaint: '#5E646D',

  accent: '#D8FF3E',
  accentFill: '#D8FF3E',
  onAccent: '#08090A',
  accentSoft: 'rgba(216, 255, 62, 0.14)',
  accentLine: 'rgba(216, 255, 62, 0.28)',

  danger: '#FF6B5A',
  dangerSoft: 'rgba(255, 107, 90, 0.14)',

  mapOverlay: 'rgba(8, 9, 10, 0.72)',

  statusBar: 'light',
};

/**
 * Daylight palette: warm paper background, ink text, and a deeper lime for
 * foregrounds so contrast stays readable on white. Fills keep the bright lime.
 */
export const lightColors: Palette = {
  bg: '#F5F5EF',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#ECEDE5',
  border: '#E0E1D8',
  borderStrong: '#C7C9BE',

  text: '#101112',
  textDim: '#585D64',
  textFaint: '#8A8F97',

  accent: '#5F7D00',
  accentFill: '#CDF25A',
  onAccent: '#101112',
  accentSoft: 'rgba(95, 125, 0, 0.12)',
  accentLine: 'rgba(95, 125, 0, 0.28)',

  danger: '#C0392B',
  dangerSoft: 'rgba(192, 57, 43, 0.12)',

  mapOverlay: 'rgba(255, 255, 255, 0.82)',

  statusBar: 'dark',
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const space = (n: number) => n * 4;

/** `rgba()` string from a hex colour, used for intensity ramps and tints. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

/** Big display numbers: tight, heavy, tabular so digits don't jitter. */
export function displayNumber(c: Palette): TextStyle {
  return {
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -2,
    color: c.text,
  };
}

/** Small all-caps labels used above stats. */
export function eyebrow(c: Palette): TextStyle {
  return {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: c.textFaint,
  };
}

export const monoNumber: TextStyle = {
  fontFamily: monoFont,
  fontVariant: ['tabular-nums'],
};

export function applyAccent(palette: Palette, accentHex: string): Palette {
  if (!accentHex) return palette;
  const fill = accentHex.startsWith('#') ? accentHex : `#${accentHex}`;
  const onAccent = contrastColor(fill);
  return {
    ...palette,
    accent: fill,
    accentFill: fill,
    accentLine: withAlpha(fill, 0.45),
    accentSoft: withAlpha(fill, 0.12),
    onAccent,
  };
}

function contrastColor(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value.split('').map((ch) => ch + ch).join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 0.6 ? '#08090A' : '#FFFFFF';
}
