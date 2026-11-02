import { Platform, TextStyle } from 'react-native';

export const colors = {
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
  accentSoft: 'rgba(216, 255, 62, 0.14)',
  accentLine: 'rgba(216, 255, 62, 0.28)',

  danger: '#FF6B5A',
  dangerSoft: 'rgba(255, 107, 90, 0.14)',

  mapOverlay: 'rgba(8, 9, 10, 0.72)',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const space = (n: number) => n * 4;

export const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
}) as string;

/** Big display numbers: tight, heavy, tabular so digits don't jitter. */
export const displayNumber: TextStyle = {
  fontVariant: ['tabular-nums'],
  fontWeight: '800',
  letterSpacing: -2,
  color: colors.text,
};

/** Small all-caps labels used above stats. */
export const eyebrow: TextStyle = {
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  color: colors.textFaint,
};

export const monoNumber: TextStyle = {
  fontFamily: monoFont,
  fontVariant: ['tabular-nums'],
};
