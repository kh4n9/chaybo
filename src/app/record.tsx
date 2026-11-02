import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Eyebrow, IconButton } from '@/components/ui';
import { saveActivity } from '@/db/activities';
import { useRecording } from '@/hooks/useRecording';
import { useSettings } from '@/hooks/useSettings';
import { autoTitle, formatDuration } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { fetchWeather, formatWeather } from '@/lib/weather';
import { monoFont, radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';

const DEFAULT_REGION = {
  latitude: 21.0287,
  longitude: 105.8524,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function RecordScreen() {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const router = useRouter();
  const db = useSQLiteContext();
  const { settings } = useSettings();
  const rec = useRecording({ voiceCoach: settings.voiceCoach });
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [weather, setWeather] = useState<string | null>(null);

  const isActive = rec.status !== 'idle';

  // Centre the map on the runner the first time we get a position.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted' || cancelled) return;
        const position = await Location.getLastKnownPositionAsync();
        if (!position || cancelled) return;
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 700);
      } catch {
        // A missing last-known position is fine; the default region is used.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const coordinates = useMemo(
    () => rec.points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [rec.points],
  );

  const currentPace = useMemo(() => {
    if (rec.currentPaceS) return rec.currentPaceS;
    const recent = rec.points.slice(-12);
    if (recent.length < 2) return null;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const seconds = (last.t - first.t) / 1000;
    if (seconds <= 0) return null;
    let meters = 0;
    for (let i = 1; i < recent.length; i++) {
      meters += haversineMeters(recent[i - 1], recent[i]);
    }
    if (meters < 5) return null;
    return (seconds / meters) * 1000;
  }, [rec.currentPaceS, rec.points]);

  const beginRecording = useCallback(async () => {
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        const position = await Location.getLastKnownPositionAsync();
        if (position) {
          const snapshot = await fetchWeather(position.coords.latitude, position.coords.longitude);
          setWeather(formatWeather(snapshot));
        }
      }
    } catch {
      // Weather is optional.
    }
    const ok = await rec.start();
    if (!ok) {
      Alert.alert(
        'Không thể bắt đầu',
        'Ứng dụng cần quyền truy cập vị trí. Hãy bật quyền trong Cài đặt > chaybo.',
      );
    }
  }, [rec]);

  const onStart = () => {
    if (countdown !== null) return;
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const id = setTimeout(() => {
        setCountdown(null);
        void beginRecording();
      }, 0);
      return () => clearTimeout(id);
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = setTimeout(() => setCountdown((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown, beginRecording]);

  /** Closing the modal must never silently throw away an in-progress run. */
  const onClose = () => {
    if (rec.status === 'idle') {
      router.back();
      return;
    }

    Alert.alert(
      'Huỷ buổi chạy này?',
      'Buổi chạy đang ghi sẽ bị xoá và không được lưu lại.',
      [
        { text: 'Tiếp tục chạy', style: 'cancel' },
        {
          text: 'Huỷ buổi chạy',
          style: 'destructive',
          onPress: () => {
            rec.stop();
            rec.reset();
            router.back();
          },
        },
      ],
    );
  };

  const onFinish = () => {
    if (rec.distanceM < 50) {
      Alert.alert('Buổi chạy quá ngắn', 'Cần ít nhất 50 m để lưu lại.', [
        { text: 'Tiếp tục', style: 'cancel' },
        {
          text: 'Bỏ',
          style: 'destructive',
          onPress: () => rec.reset(),
        },
      ]);
      return;
    }

    Alert.alert('Kết thúc buổi chạy?', undefined, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Kết thúc',
        style: 'destructive',
        onPress: async () => {
          const run = rec.stop(settings.weightKg);
          if (!run) return;
          setSaving(true);
          try {
            const id = await saveActivity(db, {
              ...run,
              title: autoTitle(run.startedAt),
              weather,
            });
            rec.reset();
            router.replace({ pathname: '/activity/[id]', params: { id } });
          } catch {
            Alert.alert('Không lưu được', 'Có lỗi khi ghi dữ liệu. Vui lòng thử lại.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        followsUserLocation={rec.status === 'recording'}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        userInterfaceStyle="dark"
      >
        {coordinates.length > 1 ? (
          <Polyline
            coordinates={coordinates}
            strokeColor={palette.accent}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
      </MapView>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(8,9,10,0.92)', 'rgba(8,9,10,0.15)', 'rgba(8,9,10,0.55)', 'rgba(8,9,10,0.97)']}
        locations={[0, 0.32, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <IconButton icon="close" onPress={onClose} accessibilityLabel="Đóng màn hình ghi" />

          <StatusPill status={rec.status} autoPaused={rec.autoPaused} />

          <Text style={styles.headerHint} numberOfLines={1}>
            {isActive
              ? rec.points.length === 0
                ? 'Đang tìm GPS...'
                : rec.background
                  ? 'GPS nền đang bật'
                  : 'GPS ổn định'
              : 'Chạm để bắt đầu ghi'}
          </Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.panel}>
          <Eyebrow>{isActive ? 'Quãng đường' : 'Sẵn sàng'}</Eyebrow>

          <View style={styles.distanceLine}>
            <Text style={styles.distance}>{u.dist(rec.distanceM)}</Text>
            <Text style={styles.distanceUnit}>{u.label}</Text>
          </View>

          <View style={styles.metricsRow}>
            <Metric label="Thời gian" value={formatDuration(rec.movingS)} />
            <View style={styles.metricDivider} />
            <Metric
              label="Pace"
              value={currentPace ? `${u.pace(currentPace)}` : `--'--"`}
              suffix={u.paceLabel}
            />
            <View style={styles.metricDivider} />
            <Metric
              label={u.label === 'mi' ? 'Dặm' : 'Km'}
              value={String(Math.floor(u.toUnit(rec.distanceM)))}
            />
          </View>

          {!isActive ? (
            <Button
              label="Bắt đầu chạy"
              icon="play"
              onPress={onStart}
              style={styles.startButton}
            />
          ) : (
            <View style={styles.controls}>
              <Pressable
                onPress={rec.status === 'paused' ? rec.resume : rec.pause}
                style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={rec.status === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
              >
                <Ionicons
                  name={rec.status === 'paused' ? 'play' : 'pause'}
                  size={26}
                  color={palette.text}
                />
              </Pressable>

              <Pressable
                onPress={onFinish}
                disabled={saving}
                style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Kết thúc buổi chạy"
              >
                {saving ? (
                  <ActivityIndicator color={palette.bg} />
                ) : (
                  <>
                    <Ionicons name="stop" size={20} color={palette.bg} />
                    <Text style={styles.stopLabel}>Kết thúc</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>

      {countdown !== null ? (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownNumber}>{countdown === 0 ? 'GO' : countdown}</Text>
          <Text style={styles.countdownHint}>Chuẩn bị chạy</Text>
          <Pressable
            onPress={() => setCountdown(null)}
            style={({ pressed }) => [styles.countdownCancel, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Huỷ đếm ngược"
          >
            <Text style={styles.countdownCancelText}>Huỷ</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function StatusPill({ status, autoPaused }: { status: 'idle' | 'recording' | 'paused'; autoPaused?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const label =
    status === 'idle'
      ? 'Chưa ghi'
      : status === 'paused'
        ? autoPaused
          ? 'Tự động dừng'
          : 'Tạm dừng'
        : 'Đang ghi';
  const active = status === 'recording';

  return (
    <View style={[styles.pill, active && styles.pillActive]}>
      <View style={[styles.pillDot, active && styles.pillDotActive]} />
      <Text style={[styles.pillText, active && { color: palette.accent }]}>{label}</Text>
    </View>
  );
}

function Metric({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label.toUpperCase()}</Text>
      <View style={styles.metricValueLine}>
        <Text style={styles.metricValue}>{value}</Text>
        {suffix ? <Text style={styles.metricSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  safe: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  headerHint: {
    flex: 1,
    fontSize: 11,
    color: c.textFaint,
    letterSpacing: 0.2,
    textAlign: 'right',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  pillActive: { borderColor: c.accentLine, backgroundColor: c.accentSoft },
  pillDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.textFaint },
  pillDotActive: { backgroundColor: c.accent },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: c.textDim,
  },
  spacer: { flex: 1 },
  panel: { paddingBottom: 8 },
  distanceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 2 },
  distance: {
    fontSize: 82,
    lineHeight: 88,
    fontWeight: '800',
    letterSpacing: -4.5,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  distanceUnit: { fontSize: 20, fontWeight: '700', color: c.accent },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  metric: { flex: 1 },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: c.textFaint,
    marginBottom: 5,
  },
  metricValueLine: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  metricSuffix: { fontSize: 10, color: c.textFaint },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: c.border,
    marginHorizontal: 12,
  },
  startButton: { marginTop: 24, paddingVertical: 18 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  circleButton: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    flex: 1,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stopLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: c.bg,
    letterSpacing: 0.3,
    fontFamily: monoFont,
  },
  pressed: { opacity: 0.7 },
  countdownOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8,9,10,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  countdownNumber: {
    fontSize: 140,
    fontWeight: '800',
    color: c.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: -6,
  },
  countdownHint: { fontSize: 14, color: c.textDim, letterSpacing: 0.4 },
  countdownCancel: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  countdownCancelText: { fontSize: 13, fontWeight: '600', color: c.textDim },
});
