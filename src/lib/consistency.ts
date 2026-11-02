import type { Split } from './types';

export type ConsistencyResult = {
  score: number;
  label: string;
  cv: number;
  spreadS: number;
  meanS: number;
};

/**
 * Measures how evenly paced a run was. Uses the coefficient of variation of the
 * per-kilometer paces; a lower CV means a more consistent run.
 */
export function paceConsistency(splits: Split[]): ConsistencyResult | null {
  const full = splits.filter((split) => split.distanceM >= 900);
  const pool = full.length >= 2 ? full : splits;
  if (pool.length < 2) return null;

  const paces = pool.map((split) => split.paceSPerKm).filter((value) => value > 0);
  if (paces.length < 2) return null;

  const mean = paces.reduce((sum, value) => sum + value, 0) / paces.length;
  if (!Number.isFinite(mean) || mean <= 0) return null;

  const variance =
    paces.reduce((sum, value) => sum + (value - mean) ** 2, 0) / paces.length;
  const cv = Math.sqrt(variance) / mean;

  const score = Math.round(100 * (1 - Math.min(1, cv * 2.2)));
  const spread = Math.max(...paces) - Math.min(...paces);

  let label = 'Dao động mạnh';
  if (score >= 90) label = 'Rất đều';
  else if (score >= 75) label = 'Khá đều';
  else if (score >= 55) label = 'Có dao động';

  return { score, label, cv, spreadS: spread, meanS: mean };
}