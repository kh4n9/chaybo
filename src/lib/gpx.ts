import { autoTitle } from './format';
import { elevationGain, estimateCalories, totalDistance } from './geo';
import { bestPaceFromSplits, computeSplits } from './splits';
import type { Split, TrackPoint } from './types';

/** One activity parsed out of a GPX file, ready to be saved. */
export type ImportedGpxTrack = {
  title: string;
  startedAt: number;
  endedAt: number;
  durationS: number;
  elapsedS: number;
  distanceM: number;
  avgPaceS: number | null;
  bestPaceS: number | null;
  elevGainM: number;
  calories: number;
  route: TrackPoint[];
  splits: Split[];
  weather?: string | null;
  gearId?: string | null;
  favorite?: boolean;
};

export class GpxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GpxError';
  }
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function attribute(attrs: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(attrs);
  return match ? match[1] : null;
}

function tag(body: string, name: string): string | null {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(body);
  return match ? decodeEntities(match[1].trim()) : null;
}

function parsePoints(segment: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  const regex = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(segment)) !== null) {
    const attrs = match[1];
    const body = match[2];

    const lat = Number(attribute(attrs, 'lat'));
    const lng = Number(attribute(attrs, 'lon') ?? attribute(attrs, 'lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const rawTime = tag(body, 'time');
    if (!rawTime) continue;
    const t = Date.parse(rawTime);
    if (!Number.isFinite(t)) continue;

    const rawEle = tag(body, 'ele');
    const alt = rawEle == null ? null : Number(rawEle);
    points.push({ lat, lng, alt: alt != null && Number.isFinite(alt) ? alt : null, t });
  }

  return points;
}

function buildTrack(
  points: TrackPoint[],
  title: string,
  weightKg: number,
): ImportedGpxTrack | null {
  if (points.length < 2) return null;

  points.sort((a, b) => a.t - b.t);

  const startedAt = points[0].t;
  const endedAt = points[points.length - 1].t;
  const durationS = (endedAt - startedAt) / 1000;
  if (durationS <= 0) return null;

  const distanceM = totalDistance(points);
  if (distanceM < 10) return null;

  const splits = computeSplits(points);

  return {
    title: title.slice(0, 60),
    startedAt,
    endedAt,
    durationS,
    elapsedS: durationS,
    distanceM,
    avgPaceS: (durationS / distanceM) * 1000,
    bestPaceS: bestPaceFromSplits(splits),
    elevGainM: elevationGain(points),
    calories: estimateCalories(distanceM, weightKg),
    route: points,
    splits,
  };
}

/**
 * Parses GPX 1.1 produced by Strava, Garmin, Apple Health exports, etc.
 * Every `<trkseg>` becomes its own activity so multi-segment files do not get
 * a fake straight line between segments.
 */
export function parseGpx(xml: string, weightKg = 62): ImportedGpxTrack[] {
  if (!xml.includes('<gpx') && !xml.includes('<trkpt')) {
    throw new GpxError('Tệp này không phải GPX hợp lệ.');
  }

  const tracks: ImportedGpxTrack[] = [];
  const trkRegex = /<trk\b[^>]*>([\s\S]*?)<\/trk>/gi;

  let trkMatch: RegExpExecArray | null;
  while ((trkMatch = trkRegex.exec(xml)) !== null) {
    const trkBody = trkMatch[1];
    const trkName = tag(trkBody, 'name');

    const segments: string[] = [];
    const segRegex = /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/gi;
    let segMatch: RegExpExecArray | null;
    while ((segMatch = segRegex.exec(trkBody)) !== null) {
      segments.push(segMatch[1]);
    }
    if (segments.length === 0) segments.push(trkBody);

    segments.forEach((segment, index) => {
      const points = parsePoints(segment);
      if (points.length < 2) return;

      const fallback = autoTitle(points[0].t);
      const base = trkName && trkName.length > 0 ? trkName : fallback;
      const title = segments.length > 1 ? `${base} (${index + 1})` : base;

      const track = buildTrack(points, title, weightKg);
      if (track) tracks.push(track);
    });
  }

  // Some tools emit a bare <trkpt> list without <trk>/<trkseg> wrappers.
  if (tracks.length === 0) {
    const points = parsePoints(xml);
    if (points.length >= 2) {
      const track = buildTrack(points, autoTitle(points[0].t), weightKg);
      if (track) tracks.push(track);
    }
  }

  if (tracks.length === 0) {
    throw new GpxError(
      'Không tìm thấy lộ trình có toạ độ và thời gian trong tệp GPX này.',
    );
  }

  return tracks;
}

/** Compact signature used to detect duplicate imports (1-minute + 10-m buckets). */
export function trackFingerprint(startedAt: number, distanceM: number): string {
  return `${Math.round(startedAt / 60000)}:${Math.round(distanceM / 10)}`;
}

export function splitDuplicateTracks<T extends { startedAt: number; distanceM: number }>(
  incoming: T[],
  existing: { startedAt: number; distanceM: number }[],
): { unique: T[]; duplicates: T[] } {
  const seen = new Set(existing.map((item) => trackFingerprint(item.startedAt, item.distanceM)));
  const unique: T[] = [];
  const duplicates: T[] = [];
  for (const track of incoming) {
    const key = trackFingerprint(track.startedAt, track.distanceM);
    if (seen.has(key)) duplicates.push(track);
    else {
      unique.push(track);
      seen.add(key);
    }
  }
  return { unique, duplicates };
}
