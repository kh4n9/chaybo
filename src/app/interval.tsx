import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Button, Eyebrow, IconButton } from '@/components/ui';
import { formatDuration } from '@/lib/format';
import {
  INTERVAL_PRESETS,
  buildIntervals,
  phaseAt,
  totalDurationS,
  type IntervalStep,
} from '@/lib/interval';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';

const RING_SIZE = 230;
const RING_RADIUS = 100;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function IntervalScreen() {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  useKeepAwake();
  const router = useRouter();

  const [presetKey, setPresetKey] = useState(INTERVAL_PRESETS[0].key);
  const [reps, setReps] = useState(6);
  const [workS, setWorkS] = useState(90);
  const [restS, setRestS] = useState(90);

  const steps = useMemo<IntervalStep[]>(() => {
    if (presetKey === 'custom') {
      return buildIntervals(reps, workS, restS, 300, 300, 'Tự chọn').steps;
    }
    const preset = INTERVAL_PRESETS.find((item) => item.key === presetKey) ?? INTERVAL_PRESETS[0];
    return preset.build().steps;
  }, [presetKey, reps, workS, restS]);

  const totalS = useMemo(() => totalDurationS(steps), [steps]);

  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const baseRef = useRef(0);
  const startedRef = useRef(0);
  const lastPhaseRef = useRef(-1);

  useEffect(() => {
    if (!running) return;
    startedRef.current = Date.now();
    const totalMs = totalS * 1000;

    const id = setInterval(() => {
      const next = baseRef.current + (Date.now() - startedRef.current);
      if (next >= totalMs) {
        baseRef.current = totalMs;
        setElapsedMs(totalMs);
        setRunning(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }
      setElapsedMs(next);

      const current = phaseAt(steps, Math.floor(next / 1000));
      if (current && current.index !== lastPhaseRef.current) {
        lastPhaseRef.current = current.index;
        void Haptics.impactAsync(
          current.step.kind === 'work'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : Haptics.ImpactFeedbackStyle.Light,
        );
      }
    }, 200);

    return () => clearInterval(id);
  }, [running, steps, totalS]);

  const elapsedS = Math.floor(elapsedMs / 1000);
  const phase = phaseAt(steps, elapsedS);
  const finished = elapsedMs >= totalS * 1000 && totalS > 0;
  const remainingS = phase ? phase.remainingS : totalS;
  const phaseTotalS = phase ? phase.step.durationS : 1;
  const phaseDoneRatio = phase ? 1 - remainingS / phaseTotalS : 0;
  const accent = phase ? phaseColor(phase.step.kind, palette) : palette.accent;
  const nextStep = phase ? steps[phase.index + 1] : null;

  const toggle = () => {
    if (finished) {
      baseRef.current = 0;
      setElapsedMs(0);
      lastPhaseRef.current = -1;
      setRunning(true);
      return;
    }
    if (running) {
      baseRef.current = elapsedMs;
      setRunning(false);
    } else {
      lastPhaseRef.current = phase?.index ?? -1;
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    baseRef.current = 0;
    setElapsedMs(0);
    lastPhaseRef.current = -1;
  };

  const choosePreset = (key: string) => {
    reset();
    setPresetKey(key);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Quay lại" />
        <Text style={styles.headerTitle}>Biến tốc</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.clockWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={palette.surfaceAlt}
              strokeWidth={10}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={accent}
              strokeWidth={10}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, phaseDoneRatio)))}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.clockCenter}>
            <Text style={styles.phaseLabel}>
              {finished ? 'HOÀN THÀNH' : (phase?.step.label ?? 'Sẵn sàng').toUpperCase()}
            </Text>
            <Text style={[styles.clockNumber, { color: finished ? palette.accent : palette.text }]}>
              {formatDuration(finished ? 0 : remainingS)}
            </Text>
            <Text style={styles.clockHint}>
              {finished
                ? `Tổng ${formatDuration(totalS)}`
                : nextStep
                  ? `Tiếp: ${nextStep.label}`
                  : 'Hiệp cuối'}
            </Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng bài</Text>
          <Text style={styles.totalValue}>{formatDuration(totalS)}</Text>
          <View style={styles.totalBar}>
            <View
              style={[
                styles.totalFill,
                { width: `${Math.min(100, Math.round((elapsedMs / 1000 / Math.max(1, totalS)) * 100))}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.controls}>
          <Button
            label={finished ? 'Chạy lại' : running ? 'Tạm dừng' : elapsedMs > 0 ? 'Tiếp tục' : 'Bắt đầu'}
            icon={finished ? 'refresh' : running ? 'pause' : 'play'}
            onPress={toggle}
            style={styles.controlButton}
          />
          <Button
            label="Đặt lại"
            variant="ghost"
            icon="reload"
            onPress={reset}
            style={styles.controlButton}
          />
        </View>

        <Eyebrow style={styles.spaced}>Bài mẫu</Eyebrow>
        <View style={styles.presetList}>
          {INTERVAL_PRESETS.map((preset) => {
            const active = preset.key === presetKey;
            return (
              <Pressable
                key={preset.key}
                onPress={() => choosePreset(preset.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.presetRow,
                  active && styles.presetRowActive,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View style={[styles.presetDot, active && { backgroundColor: palette.accent }]} />
                <View style={styles.presetBody}>
                  <Text style={[styles.presetName, active && { color: palette.accent }]}>
                    {preset.name}
                  </Text>
                  <Text style={styles.presetHint}>{preset.hint}</Text>
                </View>
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={active ? palette.accent : palette.textFaint}
                />
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => choosePreset('custom')}
            accessibilityRole="button"
            accessibilityState={{ selected: presetKey === 'custom' }}
            style={({ pressed }) => [
              styles.presetRow,
              presetKey === 'custom' && styles.presetRowActive,
              pressed && { opacity: 0.75 },
            ]}
          >
            <View
              style={[
                styles.presetDot,
                presetKey === 'custom' && { backgroundColor: palette.accent },
              ]}
            />
            <View style={styles.presetBody}>
              <Text
                style={[styles.presetName, presetKey === 'custom' && { color: palette.accent }]}
              >
                Tự chọn
              </Text>
              <Text style={styles.presetHint}>Tự đặt số hiệp và thời gian</Text>
            </View>
            <Ionicons
              name={presetKey === 'custom' ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={presetKey === 'custom' ? palette.accent : palette.textFaint}
            />
          </Pressable>
        </View>

        {presetKey === 'custom' ? (
          <View style={styles.customCard}>
            <Stepper label="Số hiệp" value={`${reps}`} onMinus={() => setReps((v) => Math.max(1, v - 1))} onPlus={() => setReps((v) => Math.min(20, v + 1))} />
            <Stepper
              label="Thời gian nhanh"
              value={formatDuration(workS)}
              onMinus={() => setWorkS((v) => Math.max(15, v - 15))}
              onPlus={() => setWorkS((v) => Math.min(600, v + 15))}
            />
            <Stepper
              label="Thời gian nghỉ"
              value={formatDuration(restS)}
              onMinus={() => setRestS((v) => Math.max(0, v - 15))}
              onPlus={() => setRestS((v) => Math.min(300, v + 15))}
            />
            <Text style={styles.customHint}>
              Mỗi hiệp tự động có 5 phút khởi động và 5 phút thả lỏng.
            </Text>
          </View>
        ) : null}

        <Eyebrow style={styles.spaced}>Các bước</Eyebrow>
        <View style={styles.stepList}>
          {steps.map((step, index) => {
            const active = phase?.index === index && !finished;
            return (
              <View key={`${step.kind}-${index}`} style={[styles.stepRow, active && styles.stepRowActive]}>
                <View style={[styles.stepBar, { backgroundColor: phaseColor(step.kind, palette) }]} />
                <Text style={[styles.stepName, active && { color: palette.text }]} numberOfLines={1}>
                  {step.label}
                </Text>
                <Text style={styles.stepTime}>{formatDuration(step.durationS)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function phaseColor(kind: IntervalStep['kind'], c: Palette): string {
  if (kind === 'work') return c.accentFill;
  if (kind === 'rest') return c.danger;
  return c.textFaint;
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={onMinus}
          style={({ pressed }) => [styles.stepperButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`Giảm ${label}`}
        >
          <Ionicons name="remove" size={16} color={palette.text} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          onPress={onPlus}
          style={({ pressed }) => [styles.stepperButton, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`Tăng ${label}`}
        >
          <Ionicons name="add" size={16} color={palette.text} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 44 },
  clockWrap: {
    alignSelf: 'center',
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  clockCenter: { position: 'absolute', alignItems: 'center', gap: 2, width: RING_SIZE - 40 },
  phaseLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: c.textDim },
  clockNumber: {
    fontSize: 50,
    lineHeight: 58,
    fontWeight: '800',
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
  },
  clockHint: { fontSize: 11, color: c.textFaint, textAlign: 'center' },
  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  totalLabel: { fontSize: 11, color: c.textFaint },
  totalValue: {
    fontSize: 12,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  totalBar: {
    flex: 1,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  totalFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.accent },
  controls: { flexDirection: 'row', gap: 10, marginTop: 20 },
  controlButton: { flex: 1 },
  spaced: { marginTop: 28 },
  presetList: { gap: 8, marginTop: 12 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 13,
  },
  presetRowActive: { borderColor: c.accentLine, backgroundColor: c.bgElevated },
  presetDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: c.borderStrong },
  presetBody: { flex: 1, gap: 2 },
  presetName: { fontSize: 13, fontWeight: '700', color: c.text },
  presetHint: { fontSize: 10, color: c.textFaint },
  customCard: {
    marginTop: 12,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  stepperLabel: { fontSize: 13, color: c.text },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 54,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  customHint: { fontSize: 10, color: c.textFaint, paddingHorizontal: 10, paddingBottom: 8, lineHeight: 15 },
  stepList: { marginTop: 12, gap: 4 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  stepRowActive: { backgroundColor: c.surface },
  stepBar: { width: 3, height: 16, borderRadius: radius.pill },
  stepName: { flex: 1, fontSize: 12, color: c.textDim },
  stepTime: {
    fontSize: 11,
    color: c.textFaint,
    fontVariant: ['tabular-nums'],
  },
});
