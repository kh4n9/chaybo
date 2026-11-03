import type { ActivitySummary } from './types';

export type HeatPoint = { x: number; y: number };

export type HeatLine = {
  id: string;
  points: HeatPoint[];
};

export type AreaHeatmap = {
  lines: HeatLine[];
  /** Density grid, row-major, length = cols × rows. */
  grid: number[];
  cols: number;
  rows: number;
  max: number;
  count: number;
};

/**
 * Projects every preview route into a shared 0..1 box and rasterises the points
 * into a density grid. Used for the “khu vực hay chạy” map without any tile
 * provider or network access.
 */
export function buildAreaHeatmap(
  activities: ActivitySummary[],
  cols = 28,
  rows = 28,
): AreaHeatmap {
  const routes = activities.filter((activity) => {
    const valid = activity.preview.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    return valid.length >= 2;
  });
  if (routes.length === 0) {
    return { lines: [], grid: new Array(cols * rows).fill(0), cols, rows, max: 0, count: 0 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const activity of routes) {
    for (const point of activity.preview) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
      if (point.lat < minLat) minLat = point.lat;
      if (point.lat > maxLat) maxLat = point.lat;
      if (point.lng < minLng) minLng = point.lng;
      if (point.lng > maxLng) maxLng = point.lng;
    }
  }

  // If nothing valid was collected, fall back to empty.
  if (!Number.isFinite(minLat)) {
    return { lines: [], grid: new Array(cols * rows).fill(0), cols, rows, max: 0, count: 0 };
  }

  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const grid = new Array<number>(cols * rows).fill(0);

  const project = (lat: number, lng: number): HeatPoint => ({
    x: Math.min(1, Math.max(0, (lng - minLng) / lngSpan)),
    // Latitude grows upwards, screen coordinates grow downwards.
    y: Math.min(1, Math.max(0, 1 - (lat - minLat) / latSpan)),
  });

  const lines: HeatLine[] = routes.map((activity) => {
    const points = activity.preview.map((point) => project(point.lat, point.lng));
    for (const point of points) {
      const col = Math.min(cols - 1, Math.floor(point.x * cols));
      const row = Math.min(rows - 1, Math.floor(point.y * rows));
      grid[row * cols + col] += 1;
    }
    return { id: activity.id, points };
  });

  const max = grid.reduce((value, cell) => Math.max(value, cell), 0);
  return { lines, grid, cols, rows, max, count: routes.length };
}
