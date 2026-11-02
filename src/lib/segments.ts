import { haversine } from './geo';
import type { ActivitySummary, TrackPoint } from './types';

/** Two routes are the same segment when both ends are within this distance. */
const MATCH_RADIUS_M = 200;

export type SegmentRun = {
  activityId: string;
  title: string;
  startedAt: number;
  distanceM: number;
  /** Estimated time on the segment, in seconds. */
  durationS: number;
  paceSPerKm: number;
};

export type PersonalSegment = {
  id: string;
  start: TrackPoint;
  end: TrackPoint;
  distanceM: number;
  runs: SegmentRun[];
  best: SegmentRun;
  /** Difference between the newest run and the best one, in seconds. */
  latestGapS: number | null;
};

function polylineDistance(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return total;
}

/**
 * Groups runs that share the same start and finish into personal segments and
 * ranks them by estimated time. Works on the downsampled preview stored with
 * each activity, so it is cheap enough to run on the history screen.
 */
export function findSegments(activities: ActivitySummary[]): PersonalSegment[] {
  type Cluster = {
    id: string;
    start: TrackPoint;
    end: TrackPoint;
    distanceM: number;
    runs: SegmentRun[];
  };

  const clusters: Cluster[] = [];

  for (const activity of activities) {
    const points = activity.preview;
    if (points.length < 2) continue;

    const start = points[0];
    const end = points[points.length - 1];
    const distanceM = polylineDistance(points);
    if (distanceM < 400) continue;

    const pace = activity.avgPaceS ?? (activity.distanceM > 0 ? (activity.durationS / activity.distanceM) * 1000 : null);
    if (!pace || pace <= 0) continue;

    const durationS = (distanceM / 1000) * pace;
    const run: SegmentRun = {
      activityId: activity.id,
      title: activity.title,
      startedAt: activity.startedAt,
      distanceM,
      durationS,
      paceSPerKm: pace,
    };

    const cluster = clusters.find(
      (candidate) =>
        haversine(candidate.start, start) <= MATCH_RADIUS_M &&
        haversine(candidate.end, end) <= MATCH_RADIUS_M,
    );

    if (cluster) {
      cluster.runs.push(run);
      cluster.distanceM = Math.max(cluster.distanceM, distanceM);
    } else {
      clusters.push({
        id: `${activity.id}-seg`,
        start,
        end,
        distanceM,
        runs: [run],
      });
    }
  }

  return clusters
    .filter((cluster) => cluster.runs.length >= 2)
    .map((cluster) => {
      const runs = [...cluster.runs].sort((a, b) => a.durationS - b.durationS);
      const best = runs[0];
      const latest = [...runs].sort((a, b) => b.startedAt - a.startedAt)[0];
      return {
        id: cluster.id,
        start: cluster.start,
        end: cluster.end,
        distanceM: cluster.distanceM,
        runs,
        best,
        latestGapS: latest ? latest.durationS - best.durationS : null,
      };
    })
    .sort((a, b) => b.runs.length - a.runs.length || b.distanceM - a.distanceM);
}

export function segmentLabel(segment: PersonalSegment): string {
  return `${(segment.distanceM / 1000).toFixed(1)} km · ${segment.runs.length} lần`;
}
