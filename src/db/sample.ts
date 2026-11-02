import type { SQLiteDatabase } from 'expo-sqlite';

import { saveActivity, type SaveActivityInput } from './activities';
import { elevationGain, estimateCalories, totalDistance } from '@/lib/geo';
import { autoTitle, startOfDay } from '@/lib/format';
import { bestPaceFromSplits, computeSplits } from '@/lib/splits';
import type { TrackPoint } from '@/lib/types';

/** Deterministic PRNG so sample routes look the same every time. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const M_PER_DEG_LAT = 110574;

type LoopOptions = {
  centerLat: number;
  centerLng: number;
  radiusX: number;
  radiusY: number;
  laps: number;
  startAngle: number;
  seed: number;
};

/** Build a lake-style loop route, repeated for the requested number of laps. */
function buildLoopRoute(opts: LoopOptions): { lat: number; lng: number; alt: number }[] {
  const rnd = mulberry32(opts.seed);
  const stepsPerLap = 90;
  const total = Math.max(2, Math.round(stepsPerLap * opts.laps));
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((opts.centerLat * Math.PI) / 180);
  const phase = rnd() * Math.PI;

  const out: { lat: number; lng: number; alt: number }[] = [];
  for (let i = 0; i <= total; i++) {
    const progress = i / stepsPerLap;
    const theta = opts.startAngle + progress * Math.PI * 2;
    const wobble =
      1 + 0.09 * Math.sin(2 * theta + phase) + 0.05 * Math.sin(3 * theta + phase * 1.7);
    const x = opts.radiusX * wobble * Math.cos(theta);
    const y = opts.radiusY * wobble * Math.sin(theta);

    const jitterX = (rnd() - 0.5) * 3;
    const jitterY = (rnd() - 0.5) * 3;

    out.push({
      lat: opts.centerLat + (y + jitterY) / M_PER_DEG_LAT,
      lng: opts.centerLng + (x + jitterX) / mPerDegLng,
      alt: 9 + 4 * Math.sin(i / 18) + (rnd() - 0.5) * 1.2,
    });
  }
  return out;
}

/** Attach timestamps to a route using a realistic pace profile. */
function withTimestamps(
  raw: { lat: number; lng: number; alt: number }[],
  startMs: number,
  targetPaceSPerKm: number,
  seed: number,
): TrackPoint[] {
  const rnd = mulberry32(seed + 99);
  const points: TrackPoint[] = [];

  let timeS = 0;
  const totalSteps = raw.length - 1;

  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (i > 0) {
      const prev = raw[i - 1];
      const stepDistance = haversineMeters(prev, p);

      const progress = i / Math.max(1, totalSteps);
      // Warm up slowly, settle in the middle, fade slightly at the end.
      const shape =
        1 + 0.10 * Math.cos(progress * Math.PI * 2) - 0.06 * Math.max(0, progress - 0.8) * 5;
      const noise = 1 + (rnd() - 0.5) * 0.05;
      const pace = targetPaceSPerKm * shape * noise;
      timeS += (stepDistance / 1000) * pace;
    }

    points.push({
      lat: p.lat,
      lng: p.lng,
      alt: p.alt,
      t: Math.round(startMs + timeS * 1000),
    });
  }

  return points;
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

type SampleSpec = {
  daysAgo: number;
  hour: number;
  minute: number;
  paceSPerKm: number;
  radiusX: number;
  radiusY: number;
  laps: number;
  centerLat: number;
  centerLng: number;
  seed: number;
  runType?: 'easy' | 'tempo' | 'long' | 'race' | 'recovery' | 'interval';
};

const HOAN_KIEM = { centerLat: 21.0287, centerLng: 105.8524 };
const THONG_NHAT = { centerLat: 21.0278, centerLng: 105.8372 };

const SPECS: SampleSpec[] = [
  { daysAgo: 1, hour: 6, minute: 12, paceSPerKm: 312, radiusX: 150, radiusY: 105, laps: 2.2, ...HOAN_KIEM, seed: 11, runType: 'tempo' },
  { daysAgo: 3, hour: 18, minute: 41, paceSPerKm: 336, radiusX: 300, radiusY: 300, laps: 3.1, ...THONG_NHAT, seed: 22, runType: 'easy' },
  { daysAgo: 5, hour: 5, minute: 55, paceSPerKm: 298, radiusX: 150, radiusY: 105, laps: 3.4, ...HOAN_KIEM, seed: 33, runType: 'interval' },
  { daysAgo: 9, hour: 19, minute: 8, paceSPerKm: 355, radiusX: 300, radiusY: 300, laps: 2.4, ...THONG_NHAT, seed: 44, runType: 'recovery' },
  { daysAgo: 12, hour: 6, minute: 30, paceSPerKm: 324, radiusX: 150, radiusY: 105, laps: 3.0, ...HOAN_KIEM, seed: 55, runType: 'long' },
  { daysAgo: 17, hour: 17, minute: 22, paceSPerKm: 368, radiusX: 300, radiusY: 300, laps: 1.7, ...THONG_NHAT, seed: 66, runType: 'easy' },
];

export function buildSampleActivities(now = Date.now(), weightKg = 62): SaveActivityInput[] {
  return SPECS.map((spec) => {
    const startMs =
      startOfDay(now) - spec.daysAgo * 86400000 + spec.hour * 3600000 + spec.minute * 60000;

    const raw = buildLoopRoute({
      centerLat: spec.centerLat,
      centerLng: spec.centerLng,
      radiusX: spec.radiusX,
      radiusY: spec.radiusY,
      laps: spec.laps,
      startAngle: spec.seed * 0.37,
      seed: spec.seed,
    });

    const route = withTimestamps(raw, startMs, spec.paceSPerKm, spec.seed);
    const distanceM = totalDistance(route);
    const durationS = (route[route.length - 1].t - route[0].t) / 1000;
    const splits = computeSplits(route);

    return {
      title: autoTitle(startMs),
      startedAt: startMs,
      endedAt: route[route.length - 1].t,
      durationS,
      elapsedS: durationS,
      distanceM,
      avgPaceS: distanceM > 0 ? (durationS / distanceM) * 1000 : null,
      bestPaceS: bestPaceFromSplits(splits),
      elevGainM: elevationGain(route),
      calories: estimateCalories(distanceM, weightKg),
      route,
      splits,
      runType: spec.runType ?? null,
    } satisfies SaveActivityInput;
  });
}

export async function seedSampleData(db: SQLiteDatabase, weightKg = 62): Promise<void> {
  for (const activity of buildSampleActivities(Date.now(), weightKg)) {
    await saveActivity(db, activity);
  }
}
