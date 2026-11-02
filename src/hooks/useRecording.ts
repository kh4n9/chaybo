import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';

import { estimateCalories, elevationGain, haversine, isAcceptablePoint, paceFromSpeed } from '@/lib/geo';
import { bestPaceFromSplits, computeSplits } from '@/lib/splits';
import { formatPace } from '@/lib/format';
import {
  setBackgroundLocationListener,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '@/lib/backgroundLocation';
import type { Split, TrackPoint } from '@/lib/types';

const KEEP_AWAKE_TAG = 'chaybo-recording';

export type RecordingStatus = 'idle' | 'recording' | 'paused';

export type FinishedRun = {
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
};

export type RecordingLap = {
  index: number;
  distanceM: number;
  durationS: number;
  paceSPerKm: number;
};

export type RecordingState = {
  status: RecordingStatus;
  points: TrackPoint[];
  distanceM: number;
  movingS: number;
  elapsedS: number;
  currentPaceS: number | null;
  startedAt: number | null;
  error: string | null;
  /** True when the current pause was triggered automatically (stationary). */
  autoPaused: boolean;
  /** Manual laps taken by the runner. */
  laps: RecordingLap[];
  /** True when this session is also tracked in the background. */
  background: boolean;
};

const INITIAL: RecordingState = {
  status: 'idle',
  points: [],
  distanceM: 0,
  movingS: 0,
  elapsedS: 0,
  currentPaceS: null,
  startedAt: null,
  error: null,
  autoPaused: false,
  laps: [],
  /** True when this session is also tracked in the background. */
  background: false,
};

export type UseRecordingOptions = { voiceCoach?: boolean; autoPauseSeconds?: number };

export function useRecording(options?: UseRecordingOptions) {
  const [state, setState] = useState<RecordingState>(INITIAL);

  useEffect(() => {
    voiceCoachRef.current = options?.voiceCoach ?? false;
  }, [options?.voiceCoach]);

  useEffect(() => {
    autoPauseThresholdMsRef.current = (options?.autoPauseSeconds ?? 20) * 1000;
  }, [options?.autoPauseSeconds]);

  const pointsRef = useRef<TrackPoint[]>([]);
  const distanceRef = useRef(0);
  const statusRef = useRef<RecordingStatus>('idle');
  const startedAtRef = useRef<number | null>(null);
  const pausedAccumMsRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acceptNextRef = useRef(true);
  const skipDistanceRef = useRef(false);
  const lapsRef = useRef<RecordingLap[]>([]);
  const lapStartDistanceRef = useRef(0);
  const lapStartMovingRef = useRef(0);
  const autoPausedRef = useRef(false);
  const lastSpeedRef = useRef<number | null>(null);
  const stationaryMsRef = useRef(0);
  const movingMsRef = useRef(0);
  const autoPauseFnRef = useRef<() => void>(() => {});
  const autoResumeFnRef = useRef<() => void>(() => {});
  const backgroundRef = useRef(false);
  const voiceCoachRef = useRef(options?.voiceCoach ?? false);
  const lastAnnouncedKmRef = useRef(0);
  const autoPauseThresholdMsRef = useRef((options?.autoPauseSeconds ?? 20) * 1000);
  const lastDistanceRef = useRef(0);
  const lastDistanceTimeRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopWatcher = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setBackgroundLocationListener(null);
    void stopBackgroundLocation();
    backgroundRef.current = false;
  }, []);

  const movingSeconds = useCallback(() => {
    if (startedAtRef.current == null) return 0;
    const now = Date.now();
    const paused = pausedAccumMsRef.current + (pausedAtRef.current ? now - pausedAtRef.current : 0);
    return Math.max(0, (now - startedAtRef.current - paused) / 1000);
  }, []);

  const onLocation = useCallback((location: Location.LocationObject) => {
    const coords = location.coords;
    lastSpeedRef.current = typeof coords.speed === 'number' ? coords.speed : null;

    if (statusRef.current === 'paused') return;
    if (statusRef.current !== 'recording') return;

    const point: TrackPoint = {
      lat: coords.latitude,
      lng: coords.longitude,
      alt: coords.altitude,
      t: location.timestamp > 0 ? location.timestamp : Date.now(),
    };

    const previous = pointsRef.current[pointsRef.current.length - 1];

    if (!acceptNextRef.current && !isAcceptablePoint(point, previous, coords.accuracy)) {
      return;
    }

    if (previous && !acceptNextRef.current && !skipDistanceRef.current) {
      distanceRef.current += haversine(previous, point);
    }

    acceptNextRef.current = false;
    skipDistanceRef.current = false;
    pointsRef.current = [...pointsRef.current, point];

    if (voiceCoachRef.current) {
      const km = Math.floor(distanceRef.current / 1000);
      if (km > 0 && km > lastAnnouncedKmRef.current) {
        lastAnnouncedKmRef.current = km;
        const paceSPerKm =
          distanceRef.current > 0 ? (movingSeconds() / distanceRef.current) * 1000 : null;
        const paceText = formatPace(paceSPerKm);
        try {
          Speech.speak(`${km} kilômét. Pace ${paceText}.`, {
            language: 'vi-VN',
            rate: 0.95,
          });
        } catch {
          // ignore TTS errors
        }
      }
    }

    const instantPace = paceFromSpeed(coords.speed);

    setState((prev) => ({
      ...prev,
      points: pointsRef.current,
      distanceM: distanceRef.current,
      movingS: movingSeconds(),
      currentPaceS: instantPace,
    }));
  }, [movingSeconds]);

  const startTick = useCallback(() => {
    clearTimers();
    tickRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.status === 'idle') return prev;
        const elapsed =
          startedAtRef.current == null ? 0 : (Date.now() - startedAtRef.current) / 1000;
        return { ...prev, movingS: movingSeconds(), elapsedS: elapsed };
      });

      const speed = lastSpeedRef.current;
      if (statusRef.current === 'recording') {
        const threshold = autoPauseThresholdMsRef.current;
        if (threshold <= 0) {
          stationaryMsRef.current = 0;
        } else {
          const distanceChanged = distanceRef.current !== lastDistanceRef.current;
          if (distanceChanged) {
            lastDistanceRef.current = distanceRef.current;
            lastDistanceTimeRef.current = Date.now();
            stationaryMsRef.current = 0;
          } else {
            const speedLow = speed == null || speed < 0.4;
            if (speedLow) {
              stationaryMsRef.current += 500;
              if (stationaryMsRef.current >= threshold) {
                stationaryMsRef.current = 0;
                autoPauseFnRef.current();
              }
            } else {
              stationaryMsRef.current = 0;
            }
          }
        }
      }
      if (statusRef.current === 'paused' && autoPausedRef.current) {
        if (speed != null && speed > 1.3) {
          movingMsRef.current += 500;
          if (movingMsRef.current >= 4000) {
            movingMsRef.current = 0;
            autoResumeFnRef.current();
          }
        } else {
          movingMsRef.current = 0;
        }
      }
    }, 500);
  }, [clearTimers, movingSeconds]);

  const start = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setState((prev) => ({
        ...prev,
        error: 'Cần quyền truy cập vị trí để ghi lại buổi chạy.',
      }));
      return false;
    }

    pointsRef.current = [];
    distanceRef.current = 0;
    pausedAccumMsRef.current = 0;
    pausedAtRef.current = null;
    autoPausedRef.current = false;
    stationaryMsRef.current = 0;
    movingMsRef.current = 0;
    acceptNextRef.current = true;
    skipDistanceRef.current = false;
    lapsRef.current = [];
    lapStartDistanceRef.current = 0;
    lapStartMovingRef.current = 0;
    lastAnnouncedKmRef.current = 0;
    lastDistanceRef.current = 0;
    lastDistanceTimeRef.current = Date.now();
    startedAtRef.current = Date.now();
    statusRef.current = 'recording';

    // Try to enable background tracking. This may prompt for "Always" permission.
    const background = await startBackgroundLocation().catch(() => false);
    backgroundRef.current = background;

    setState({
      ...INITIAL,
      status: 'recording',
      startedAt: startedAtRef.current,
      background,
    });

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);

    if (background) {
      setBackgroundLocationListener((locations) => {
        locations.forEach((location) => onLocation(location));
      });
    } else {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
        },
        onLocation,
      );
    }

    startTick();
    return true;
  }, [onLocation, startTick]);

  const pauseRun = useCallback(
    (auto: boolean) => {
      if (statusRef.current !== 'recording') return;
      statusRef.current = 'paused';
      pausedAtRef.current = Date.now();
      autoPausedRef.current = auto;
      stationaryMsRef.current = 0;
      movingMsRef.current = 0;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setState((prev) => ({
        ...prev,
        status: 'paused',
        autoPaused: auto,
        movingS: movingSeconds(),
        currentPaceS: null,
      }));
    },
    [movingSeconds],
  );

  const resumeRun = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    if (pausedAtRef.current) pausedAccumMsRef.current += Date.now() - pausedAtRef.current;
    pausedAtRef.current = null;
    statusRef.current = 'recording';
    acceptNextRef.current = true;
    skipDistanceRef.current = true;
    autoPausedRef.current = false;
    stationaryMsRef.current = 0;
    movingMsRef.current = 0;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((prev) => ({ ...prev, status: 'recording', autoPaused: false }));
  }, []);

  const pause = useCallback(() => pauseRun(false), [pauseRun]);
  const resume = useCallback(() => resumeRun(), [resumeRun]);

  useEffect(() => {
    autoPauseFnRef.current = () => pauseRun(true);
    autoResumeFnRef.current = () => resumeRun();
  }, [pauseRun, resumeRun]);

  const lap = useCallback(() => {
    if (statusRef.current !== 'recording' || startedAtRef.current == null) return;
    const nowMoving = movingSeconds();
    const lapDistance = distanceRef.current - lapStartDistanceRef.current;
    const lapDuration = nowMoving - lapStartMovingRef.current;
    if (lapDistance < 5 || lapDuration <= 0) return;
    const newLap: RecordingLap = {
      index: lapsRef.current.length + 1,
      distanceM: lapDistance,
      durationS: lapDuration,
      paceSPerKm: (lapDuration / lapDistance) * 1000,
    };
    lapsRef.current = [...lapsRef.current, newLap];
    lapStartDistanceRef.current = distanceRef.current;
    lapStartMovingRef.current = nowMoving;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((prev) => ({ ...prev, laps: lapsRef.current }));
  }, [movingSeconds]);

  const stop = useCallback((weightKg?: number): FinishedRun | null => {
    if (statusRef.current === 'idle' || startedAtRef.current == null) return null;

    const endedAt = Date.now();
    const durationS = movingSeconds();
    const elapsedS = (endedAt - startedAtRef.current) / 1000;
    const route = pointsRef.current;
    const distanceM = distanceRef.current;
    const splits = computeSplits(route);

    statusRef.current = 'idle';
    pausedAtRef.current = null;
    autoPausedRef.current = false;
    stationaryMsRef.current = 0;
    movingMsRef.current = 0;
    lastAnnouncedKmRef.current = 0;
    lastDistanceRef.current = 0;
    lastDistanceTimeRef.current = null;
    try {
      Speech.stop();
    } catch {
      // ignore
    }
    stopWatcher();
    clearTimers();
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setState((prev) => ({ ...prev, status: 'idle', currentPaceS: null, autoPaused: false, background: false }));

    if (distanceM < 50) return null;

    return {
      startedAt: startedAtRef.current,
      endedAt,
      durationS,
      elapsedS,
      distanceM,
      avgPaceS: distanceM > 0 ? (durationS / distanceM) * 1000 : null,
      bestPaceS: bestPaceFromSplits(splits),
      elevGainM: elevationGain(route),
      calories: estimateCalories(distanceM, weightKg),
      route,
      splits,
    };
  }, [clearTimers, movingSeconds, stopWatcher]);

  const reset = useCallback(() => {
    statusRef.current = 'idle';
    startedAtRef.current = null;
    pointsRef.current = [];
    distanceRef.current = 0;
    pausedAccumMsRef.current = 0;
    pausedAtRef.current = null;
    autoPausedRef.current = false;
    stationaryMsRef.current = 0;
    movingMsRef.current = 0;
    lapsRef.current = [];
    lapStartDistanceRef.current = 0;
    lapStartMovingRef.current = 0;
    lastAnnouncedKmRef.current = 0;
    lastDistanceRef.current = 0;
    lastDistanceTimeRef.current = null;
    backgroundRef.current = false;
    try {
      Speech.stop();
    } catch {
      // ignore
    }
    void stopBackgroundLocation();
    setBackgroundLocationListener(null);
    setState(INITIAL);
  }, []);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      setBackgroundLocationListener(null);
      void stopBackgroundLocation();
      if (tickRef.current) clearInterval(tickRef.current);
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, []);

  return { ...state, start, pause, resume, stop, reset, lap };
}
