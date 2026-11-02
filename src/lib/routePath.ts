import type { TrackPoint } from './types';

export type ProjectedRoute = {
  d: string;
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  /** True when every point collapses to the same pixel. */
  degenerate: boolean;
};

const EMPTY: ProjectedRoute = { d: '', start: null, end: null, degenerate: true };

/**
 * Project a lat/lng route onto a box of `width` x `height` using an
 * equirectangular projection (good enough at city scale) and return an SVG path.
 * The aspect ratio is preserved so the shape never looks stretched.
 */
export function projectRoute(
  points: TrackPoint[],
  width: number,
  height: number,
  padding = 6,
): ProjectedRoute {
  if (points.length < 2 || width <= 0 || height <= 0) return EMPTY;

  const simplified = simplify(points, 6);

  let meanLat = 0;
  for (const p of simplified) meanLat += p.lat;
  meanLat /= simplified.length;
  const kx = Math.cos((meanLat * Math.PI) / 180);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of simplified) {
    const x = p.lng * kx;
    const y = p.lat;
    xs.push(x);
    ys.push(y);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);

  if (spanX === 0 && spanY === 0) {
    const cx = width / 2;
    const cy = height / 2;
    return { d: `M${cx},${cy}`, start: { x: cx, y: cy }, end: { x: cx, y: cy }, degenerate: true };
  }

  const scale = Math.min(spanX > 0 ? innerW / spanX : Infinity, spanY > 0 ? innerH / spanY : Infinity);
  const drawW = spanX * scale;
  const drawH = spanY * scale;
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  const toX = (x: number) => offsetX + (x - minX) * scale;
  const toY = (y: number) => offsetY + (maxY - y) * scale; // invert: north is up

  let d = '';
  for (let i = 0; i < simplified.length; i++) {
    const px = round(toX(xs[i]));
    const py = round(toY(ys[i]));
    d += i === 0 ? `M${px},${py}` : `L${px},${py}`;
  }

  return {
    d,
    start: { x: round(toX(xs[0])), y: round(toY(ys[0])) },
    end: { x: round(toX(xs[xs.length - 1])), y: round(toY(ys[ys.length - 1])) },
    degenerate: false,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Ramer–Douglas–Peucker with a pixel-ish tolerance in meters. */
export function simplify(points: TrackPoint[], toleranceMeters: number): TrackPoint[] {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDist = -1;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
      const dist = perpendicularDistance(points[i], points[first], points[last]);
      if (dist > maxDist) {
        maxDist = dist;
        index = i;
      }
    }

    if (maxDist > toleranceMeters && index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out: TrackPoint[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/**
 * Small, cheap polyline for list thumbnails: simplified to a tolerance of a few
 * meters and capped at `maxPoints` vertices.
 */
export function makePreview(points: TrackPoint[], maxPoints = 48): TrackPoint[] {
  if (points.length <= 2) return points;

  let simplified = simplify(points, 12);
  if (simplified.length > maxPoints) {
    const step = (simplified.length - 1) / (maxPoints - 1);
    const sampled: TrackPoint[] = [];
    for (let i = 0; i < maxPoints; i++) {
      sampled.push(simplified[Math.round(i * step)]);
    }
    simplified = sampled;
  }
  return simplified;
}

function perpendicularDistance(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  // Local planar approximation, accurate enough for a few kilometers.
  const k = Math.cos((a.lat * Math.PI) / 180) * 111320;
  const kLat = 110540;
  const ax = a.lng * k;
  const ay = a.lat * kLat;
  const bx = b.lng * k;
  const by = b.lat * kLat;
  const px = p.lng * k;
  const py = p.lat * kLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
