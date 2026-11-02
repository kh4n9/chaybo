import type { TrackPoint } from './types';

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two coordinates. */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function totalDistance(points: TrackPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return d;
}

/**
 * Smoothed positive elevation gain. Raw GPS altitude is noisy, so we average it
 * over a small window and only count climbs above a threshold.
 */
export function elevationGain(points: TrackPoint[], threshold = 1.5): number {
  const alts: number[] = [];
  for (const p of points) {
    if (p.alt != null && isFinite(p.alt)) alts.push(p.alt);
  }
  if (alts.length < 4) return 0;

  const window = 5;
  const smoothed: number[] = [];
  for (let i = 0; i < alts.length; i++) {
    const from = Math.max(0, i - Math.floor(window / 2));
    const to = Math.min(alts.length, i + Math.ceil(window / 2));
    let sum = 0;
    for (let j = from; j < to; j++) sum += alts[j];
    smoothed.push(sum / (to - from));
  }

  let gain = 0;
  let pending = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const diff = smoothed[i] - smoothed[i - 1];
    if (diff > 0) {
      pending += diff;
      if (pending >= threshold) {
        gain += pending;
        pending = 0;
      }
    } else {
      pending = 0;
    }
  }
  return gain;
}

/** Rough calorie estimate for running: ~1 kcal per kg per km. */
export function estimateCalories(distanceM: number, weightKg = 62): number {
  return Math.round((distanceM / 1000) * weightKg);
}

/** Bounding box used to frame a map on a route. */
export function boundsOf(points: TrackPoint[]) {
  if (points.length === 0) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.002, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.002, (maxLng - minLng) * 1.6),
  };
}

/**
 * Drop points that the GPS got wrong: poor accuracy, jitter, or impossible jumps.
 * Applied live while recording so stored routes stay clean.
 */
export function isAcceptablePoint(
  point: TrackPoint,
  previous: TrackPoint | undefined,
  accuracy: number | null,
): boolean {
  if (accuracy != null && accuracy > 35) return false;
  if (!previous) return true;

  const d = haversine(previous, point);
  const dt = Math.max(0.2, (point.t - previous.t) / 1000);

  if (d < 2) return false; // standing still / jitter
  if (d / dt > 12) return false; // > 43 km/h, not running
  return true;
}

/** Instantaneous pace (s/km) from a speed in m/s. */
export function paceFromSpeed(speed: number | null | undefined): number | null {
  if (!speed || !isFinite(speed) || speed <= 0.3) return null;
  return 1000 / speed;
}
