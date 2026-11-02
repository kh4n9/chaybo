/**
 * VO2max estimate from a race-like effort using the Daniels/Gilbert model.
 * No sensor required, so it works with the GPS-only data the app stores.
 */

export type Vo2Estimate = {
  value: number;
  label: string;
  sourceDistanceM: number;
  sourceTimeS: number;
};

function oxygenCost(velocityMPerMin: number): number {
  return -4.6 + 0.182258 * velocityMPerMin + 0.000104 * velocityMPerMin * velocityMPerMin;
}

function sustainableFraction(minutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * minutes) +
    0.2989558 * Math.exp(-0.1932605 * minutes)
  );
}

/** Returns the estimated VO2max for one effort, or `null` when unusable. */
export function estimateVo2max(distanceM: number, durationS: number): number | null {
  if (distanceM < 1500 || durationS < 240) return null;
  const minutes = durationS / 60;
  const velocity = distanceM / minutes;
  const cost = oxygenCost(velocity);
  const fraction = sustainableFraction(minutes);
  if (fraction <= 0 || cost <= 0) return null;
  const value = cost / fraction;
  if (!Number.isFinite(value) || value < 15 || value > 95) return null;
  return Math.round(value * 10) / 10;
}

export function bestVo2max(
  activities: { distanceM: number; durationS: number; startedAt: number }[],
): Vo2Estimate | null {
  let best: Vo2Estimate | null = null;

  for (const activity of activities) {
    if (activity.distanceM < 1500) continue;
    const value = estimateVo2max(activity.distanceM, activity.durationS);
    if (value == null) continue;
    if (!best || value > best.value) {
      best = {
        value,
        label: vo2maxLabel(value),
        sourceDistanceM: activity.distanceM,
        sourceTimeS: activity.durationS,
      };
    }
  }

  return best;
}

export function vo2maxLabel(value: number): string {
  if (value >= 60) return 'Xuất sắc';
  if (value >= 52) return 'Rất tốt';
  if (value >= 45) return 'Tốt';
  if (value >= 38) return 'Trung bình';
  return 'Cần cải thiện';
}
