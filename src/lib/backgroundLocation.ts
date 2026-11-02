import { Platform } from 'react-native';

import * as Location from 'expo-location';

// `expo-task-manager` is not shipped for web; only import it off the main
// bundle when we are actually on a native platform.
let TaskManager: typeof import('expo-task-manager') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TaskManager = require('expo-task-manager');
}

export const BACKGROUND_LOCATION_TASK = 'chaybo-background-location';

type Listener = (locations: Location.LocationObject[]) => void;

let listener: Listener | null = null;

/** Register a callback that receives background location updates. */
export function setBackgroundLocationListener(next: Listener | null) {
  listener = next;
}

// Register the task at module scope so the OS can find it when the app is
// launched headless. Guarded: TaskManager may be unavailable in Expo Go.
if (Platform.OS !== 'web' && TaskManager) {
  try {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
      if (error) return;
      const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
      if (!locations || locations.length === 0) return;
      listener?.(locations);
    });
  } catch {
    // TaskManager unavailable (e.g. Expo Go); foreground tracking only.
  }
}

/** Whether background location can run on this device / build. */
export async function isBackgroundLocationSupported(): Promise<boolean> {
  if (Platform.OS === 'web' || !TaskManager) return false;
  try {
    const [tm, bg] = await Promise.all([
      TaskManager.isAvailableAsync(),
      Location.isBackgroundLocationAvailableAsync(),
    ]);
    return tm && bg;
  } catch {
    return false;
  }
}

/** Request "Always" permission and start background updates. */
export async function startBackgroundLocation(): Promise<boolean> {
  if (!(await isBackgroundLocationSupported())) return false;
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') return false;
    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') return false;

    const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (already) return true;

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 2,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      deferredUpdatesInterval: 0,
      foregroundService: {
        notificationTitle: 'chaybo đang ghi buổi chạy',
        notificationBody: 'Vị trí được ghi lại ngay cả khi bạn tắt màn hình.',
        notificationColor: '#D8FF3E',
        killServiceOnDestroy: false,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Stop background updates if they are running. */
export async function stopBackgroundLocation(): Promise<void> {
  if (Platform.OS === 'web' || !TaskManager) return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    // ignore
  }
}