import { Platform } from 'react-native';

import {
  formatDistance,
  formatDuration,
  formatPaceFor,
  paceUnitLabel,
  unitLabel,
  type DistanceUnit,
} from '@/lib/format';

/**
 * Props drawn by the native Lock Screen / Dynamic Island layout that ships with
 * the app (see `scripts/patch-expo-widgets-live-activity.js`).
 *
 * Everything the Lock Screen needs is sent through the ActivityKit content
 * state, so no App Group — and no shared container — is required.
 */
export type RunActivityProps = {
  /** "5,24" — already formatted in the unit chosen in settings. */
  distance: string;
  /** "km" or "mi". */
  distanceUnit: string;
  /** "32:18". */
  duration: string;
  /** "6'10\"" or "--". */
  pace: string;
  /** "/km" or "/mi". */
  paceUnit: string;
  status: 'running' | 'paused';
};

type NativeActivity = {
  update(props: RunActivityProps, staleDate?: Date): Promise<void>;
  end(
    dismissalPolicy?: 'default' | 'immediate',
    props?: RunActivityProps,
    contentDate?: Date,
  ): Promise<void>;
};

type NativeFactory = {
  start(props: RunActivityProps, url?: string): NativeActivity;
  getInstances(): NativeActivity[];
};

const ACTIVITY_NAME = 'ChayboRun';
const ACTIVITY_URL = 'chaybo://record';
/** iOS throttles Live Activity updates; four seconds is plenty for a pace display. */
const MIN_UPDATE_INTERVAL_MS = 4000;

// `expo-widgets` is not part of Expo Go. Loading it lazily keeps Expo Go usable:
// `requireNativeModule` throws there and we simply fall back to no Live Activity.
let widgets: typeof import('expo-widgets') | null = null;
if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widgets = require('expo-widgets');
  } catch {
    widgets = null;
  }
}

let factory: NativeFactory | null = null;
let factoryResolved = false;
let activity: NativeActivity | null = null;
let lastPushAt = 0;

function getFactory(): NativeFactory | null {
  if (factoryResolved) return factory;
  factoryResolved = true;
  if (!widgets) return null;
  try {
    // The Lock Screen layout is drawn in Swift by the widget extension, so the
    // JS layout string is unused. Shipping a real JS layout would need an App
    // Group to reach the extension process.
    const create = widgets.createLiveActivity as unknown as (
      name: string,
      layout: string,
    ) => NativeFactory;
    factory = create(ACTIVITY_NAME, '');
  } catch {
    factory = null;
  }
  return factory;
}

/** Build the Lock Screen payload from the recording state. */
export function buildRunActivityProps(input: {
  distanceM: number;
  movingS: number;
  unit: DistanceUnit;
  paused: boolean;
}): RunActivityProps {
  const paceS =
    input.distanceM > 0 && input.movingS > 0
      ? (input.movingS / input.distanceM) * 1000
      : null;

  return {
    distance: formatDistance(input.distanceM, input.unit, 2),
    distanceUnit: unitLabel(input.unit),
    duration: formatDuration(input.movingS),
    pace: formatPaceFor(paceS, input.unit),
    paceUnit: paceUnitLabel(input.unit),
    status: input.paused ? 'paused' : 'running',
  };
}

/** Show the run on the Lock Screen and in the Dynamic Island. */
export function startRunActivity(props: RunActivityProps): void {
  const current = getFactory();
  if (!current) return;
  try {
    activity = current.start(props, ACTIVITY_URL);
    lastPushAt = Date.now();
  } catch {
    activity = null;
  }
}

/**
 * Push new numbers to the Lock Screen. Throttled unless `force` is set, because
 * iOS rate-limits Live Activity updates.
 */
export function updateRunActivity(props: RunActivityProps, force = false): void {
  const current = activity;
  if (!current) return;

  const now = Date.now();
  if (!force && now - lastPushAt < MIN_UPDATE_INTERVAL_MS) return;
  lastPushAt = now;

  try {
    void current.update(props).catch(() => {
      activity = null;
    });
  } catch {
    activity = null;
  }
}

/** Remove the run from the Lock Screen (finished or discarded run). */
export function endRunActivity(props?: RunActivityProps, immediate = false): void {
  const current = activity;
  activity = null;
  lastPushAt = 0;
  if (!current) return;
  try {
    void current.end(immediate ? 'immediate' : 'default', props).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Recording state is not persisted across app launches, so any activity still
 * on the Lock Screen at start-up is stale. Clear it instead of leaving old
 * numbers behind.
 */
export function clearStaleRunActivities(): void {
  const current = getFactory();
  if (!current) return;
  try {
    for (const instance of current.getInstances()) {
      void instance.end('immediate').catch(() => {});
    }
  } catch {
    // ignore
  }
}
