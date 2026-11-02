const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** 3725 -> "1:02:05", 125 -> "2:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

/** Seconds per km -> 5'32" */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm || !isFinite(secondsPerKm) || secondsPerKm <= 0) return '--';
  const s = Math.round(secondsPerKm);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}'${pad(sec)}"`;
}

/** 12345 -> "12.35" */
export function formatKm(meters: number, digits = 2): string {
  return (meters / 1000).toFixed(digits);
}

export type DistanceUnit = 'km' | 'mi';

export const METRES_PER_MILE = 1609.344;
const FEET_PER_METRE = 3.28084;

export function metersToUnit(meters: number, unit: DistanceUnit): number {
  return unit === 'mi' ? meters / METRES_PER_MILE : meters / 1000;
}

/** Inverse of `metersToUnit`: a value in km or miles -> metres. */
export function unitToMeters(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * METRES_PER_MILE : value * 1000;
}

export function unitLabel(unit: DistanceUnit): string {
  return unit === 'mi' ? 'mi' : 'km';
}

export function formatDistance(meters: number, unit: DistanceUnit, digits = 2): string {
  const value = metersToUnit(meters, unit).toFixed(digits).replace('.', ',');
  return value;
}

/** 12345 -> "12,35" (Vietnamese decimal comma) */
export function formatKmDecimal(meters: number, digits = 2): string {
  return (meters / 1000).toFixed(digits).replace('.', ',');
}

/** 12345 -> "12,3" (Vietnamese decimal comma, 1 digit) */
export function formatKmShort(meters: number): string {
  return formatKmDecimal(meters, 1);
}

export function formatElevation(meters: number): string {
  return `${Math.round(meters)}`;
}

/**
 * Seconds per km -> pace string in the chosen unit: 5'32" per km, 8'54" per
 * mile. Always stored as seconds-per-km so records and splits stay comparable.
 */
export function formatPaceFor(
  secondsPerKm: number | null | undefined,
  unit: DistanceUnit,
): string {
  if (!secondsPerKm || !isFinite(secondsPerKm) || secondsPerKm <= 0) return '--';
  const perUnit = unit === 'mi' ? secondsPerKm * (METRES_PER_MILE / 1000) : secondsPerKm;
  const s = Math.round(perUnit);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}'${pad(sec)}"`;
}

/** "/km" or "/mi" — the suffix shown after a pace. */
export function paceUnitLabel(unit: DistanceUnit): string {
  return unit === 'mi' ? '/mi' : '/km';
}

/** Elevation in metres or feet, without the unit suffix. */
export function formatElevationFor(meters: number, unit: DistanceUnit): string {
  return `${Math.round(unit === 'mi' ? meters * FEET_PER_METRE : meters)}`;
}

export function elevationUnitLabel(unit: DistanceUnit): string {
  return unit === 'mi' ? 'ft' : 'm';
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 of the week containing `ms`. */
export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** First day of the month containing `ms`, at 00:00. */
export function startOfMonth(ms: number): number {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** January 1st of the year containing `ms`, at 00:00. */
export function startOfYear(ms: number): number {
  const d = new Date(ms);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Lowercase and strip Vietnamese diacritics so "chay buoi sang" matches
 * "Chạy buổi sáng".
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Hôm nay", "Hôm qua", "T4, 29/10" */
export function formatDayLabel(ms: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ms);
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

export function formatFullDate(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatMonthLabel(ms: number): string {
  const d = new Date(ms);
  return `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

export function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

/** Auto title based on when the run started. */
export function autoTitle(ms: number): string {
  const h = new Date(ms).getHours();
  if (h < 11) return 'Chạy buổi sáng';
  if (h < 14) return 'Chạy buổi trưa';
  if (h < 18) return 'Chạy buổi chiều';
  return 'Chạy buổi tối';
}
