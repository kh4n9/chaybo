import { useMemo } from 'react';

import { useSettings } from '@/hooks/useSettings';
import {
  elevationUnitLabel,
  formatDistance,
  formatElevationFor,
  formatPaceFor,
  metersToUnit,
  paceUnitLabel,
  unitLabel,
  type DistanceUnit,
} from '@/lib/format';

export type UnitFormatters = {
  unit: DistanceUnit;
  /** "km" or "mi" */
  label: string;
  /** "/km" or "/mi" */
  paceLabel: string;
  /** "m" or "ft" */
  elevLabel: string;
  /** metres -> "12,35" (or "7,67" in miles) */
  dist: (meters: number, digits?: number) => string;
  /** metres -> raw number in the chosen unit (12.35 km or 7.67 mi) */
  toUnit: (meters: number) => number;
  /** seconds per km -> "5'32\"" in the chosen unit */
  pace: (secondsPerKm: number | null | undefined) => string;
  /** metres -> "128" (metres or feet) */
  elev: (meters: number) => string;
};

/** Distance, pace and elevation formatting in the unit chosen in settings. */
export function useUnit(): UnitFormatters {
  const { settings } = useSettings();
  const unit = settings.units;

  return useMemo(
    () => ({
      unit,
      label: unitLabel(unit),
      paceLabel: paceUnitLabel(unit),
      elevLabel: elevationUnitLabel(unit),
      dist: (meters: number, digits = 2) => formatDistance(meters, unit, digits),
      toUnit: (meters: number) => metersToUnit(meters, unit),
      pace: (secondsPerKm: number | null | undefined) => formatPaceFor(secondsPerKm, unit),
      elev: (meters: number) => formatElevationFor(meters, unit),
    }),
    [unit],
  );
}
