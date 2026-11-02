import { formatDuration } from './format';

export type RacePrediction = {
  label: string;
  distanceM: number;
  seconds: number;
};

const TARGETS: { label: string; distanceM: number }[] = [
  { label: '5 km', distanceM: 5000 },
  { label: '10 km', distanceM: 10000 },
  { label: 'Bán marathon', distanceM: 21097.5 },
  { label: 'Marathon', distanceM: 42195 },
];

/**
 * Riegel formula: T2 = T1 * (D2/D1)^1.06, using the best known effort as
 * the reference. Predictions beyond the reference distance are extrapolated.
 */
export function predictRaces(
  referenceDistanceM: number,
  referenceTimeS: number,
): RacePrediction[] {
  if (referenceDistanceM <= 0 || referenceTimeS <= 0) return [];
  return TARGETS.map((target) => {
    const ratio = target.distanceM / referenceDistanceM;
    const seconds = referenceTimeS * Math.pow(ratio, 1.06);
    return { label: target.label, distanceM: target.distanceM, seconds };
  });
}

export function formatPrediction(prediction: RacePrediction): string {
  return `${prediction.label}: ${formatDuration(prediction.seconds)}`;
}