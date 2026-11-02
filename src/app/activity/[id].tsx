import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { BarChart } from '@/components/BarChart';
import { ShareCard, type ShareCardVariant } from '@/components/ShareCard';
import { SplitsList } from '@/components/SplitsList';
import { Button, Eyebrow, IconButton } from '@/components/ui';
import {
  deleteActivity,
  getActivity,
  getPreviousActivity,
  updateActivityNotes,
  updateActivityGear,
  updateActivityFavorite,
  updateActivityRunType,
  updateActivityTitle,
} from '@/db/activities';
import { listGear, recomputeGearDistance, type Gear } from '@/db/gear';
import { buildGpx, fileStamp, shareTextFile } from '@/lib/export';
import { bestEffortsFor, EFFORT_DISTANCES } from '@/lib/efforts';
import { FEELINGS } from '@/lib/feeling';
import { ElevationProfile } from '@/components/ElevationProfile';
import { formatDayLabel, formatDuration, formatFullDate, formatTime, METRES_PER_MILE } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { boundsOf } from '@/lib/geo';
import { hydrationMl } from '@/lib/hydration';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';
import { paceConsistency } from '@/lib/consistency';
import { computeSplits } from '@/lib/splits';
import { RUN_TYPES, runTypeLabel } from '@/lib/runType';
import type { Activity, ActivitySummary, Feeling, RunType } from '@/lib/types';

const CARD_VARIANTS: { key: ShareCardVariant; label: string }[] = [
  { key: 'classic', label: 'Cổ điển' },
  { key: 'minimal', label: 'Tối giản' },
  { key: 'poster', label: 'Poster' },
  { key: 'neon', label: 'Neon' },
];

export default function ActivityDetailScreen() {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [exporting, setExporting] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [feelingDraft, setFeelingDraft] = useState<Feeling | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [cardVariant, setCardVariant] = useState<ShareCardVariant>('classic');
  const [runTypeDraft, setRunTypeDraft] = useState<RunType | null>(null);
  const [savingRunType, setSavingRunType] = useState(false);
  const [previousActivity, setPreviousActivity] = useState<ActivitySummary | null>(null);
  const [gearList, setGearList] = useState<Gear[]>([]);
  const [savingGear, setSavingGear] = useState(false);
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      const found = await getActivity(db, id);
      if (cancelled) return;
      setActivity(found);
      setNotesDraft(found?.notes ?? '');
      setFeelingDraft(found?.feeling ?? null);
      setRunTypeDraft(found?.runType ?? null);
      if (found) {
        const prev = await getPreviousActivity(db, found.startedAt);
        if (!cancelled) setPreviousActivity(prev);
      }
      const gearRows = await listGear(db);
      if (!cancelled) setGearList(gearRows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  const coordinates = useMemo(
    () =>
      activity?.route.map((p) => ({ latitude: p.lat, longitude: p.lng })) ?? [],
    [activity],
  );

  const region = useMemo(() => {
    const bounds = activity ? boundsOf(activity.route) : null;
    if (!bounds) return null;
    return {
      latitude: bounds.latitude,
      longitude: bounds.longitude,
      latitudeDelta: bounds.latitudeDelta,
      longitudeDelta: bounds.longitudeDelta,
    };
  }, [activity]);

  const splits = useMemo(() => {
    if (!activity) return [];
    // Stored splits are per kilometre; miles are re-bucketed from the route.
    if (u.unit === 'mi' && activity.route.length > 1) {
      return computeSplits(activity.route, METRES_PER_MILE);
    }
    return activity.splits;
  }, [activity, u.unit]);

  const paceValues = useMemo(() => splits.map((s) => 1000 / s.paceSPerKm), [splits]);

  const fastestSplitIndex = useMemo(() => {
    if (splits.length === 0) return 0;
    let best = 0;
    splits.forEach((s, i) => {
      if (s.paceSPerKm < splits[best].paceSPerKm) best = i;
    });
    return best;
  }, [splits]);

  const efforts = useMemo(
    () => (activity ? bestEffortsFor(activity.route) : null),
    [activity],
  );

  const consistency = useMemo(
    () => (activity ? paceConsistency(activity.splits) : null),
    [activity],
  );

  const onDelete = () => {
    Alert.alert('Xoá buổi chạy?', 'Dữ liệu này sẽ mất và không thể khôi phục.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          if (!activity) return;
          await deleteActivity(db, activity.id);
          router.back();
        },
      },
    ]);
  };

  const onShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Không chia sẻ được', 'Thiết bị này không hỗ trợ chia sẻ tệp.');
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Chia sẻ buổi chạy',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert('Có lỗi', 'Không tạo được ảnh chia sẻ. Vui lòng thử lại.');
    } finally {
      setSharing(false);
    }
  };

  const openRename = () => {
    if (!activity) return;
    setTitleDraft(activity.title);
    setRenameOpen(true);
  };

  const saveRename = async () => {
    if (!activity) return;
    const next = titleDraft.trim().replace(/\s+/g, ' ');
    if (next.length === 0) {
      Alert.alert('Tên không hợp lệ', 'Tên buổi chạy không được để trống.');
      return;
    }
    await updateActivityTitle(db, activity.id, next);
    setActivity((prev) => (prev ? { ...prev, title: next } : prev));
    setRenameOpen(false);
  };

  const saveNotes = async () => {
    if (!activity) return;
    setSavingNotes(true);
    try {
      const notes = notesDraft.slice(0, 2000);
      await updateActivityNotes(db, activity.id, notes, feelingDraft);
      setActivity((prev) => (prev ? { ...prev, notes, feeling: feelingDraft } : prev));
    } catch {
      Alert.alert('Có lỗi', 'Không lưu được ghi chú. Vui lòng thử lại.');
    } finally {
      setSavingNotes(false);
    }
  };

  const saveRunType = async (next: RunType | null) => {
    if (!activity) return;
    setSavingRunType(true);
    try {
      await updateActivityRunType(db, activity.id, next);
      setRunTypeDraft(next);
      setActivity((prev) => (prev ? { ...prev, runType: next } : prev));
    } catch {
      Alert.alert('Có lỗi', 'Không lưu được loại buổi chạy.');
    } finally {
      setSavingRunType(false);
    }
  };

  const onExportGpx = async () => {
    if (!activity) return;
    setExporting(true);
    try {
      await shareTextFile(
        `chaybo-${fileStamp(activity.startedAt)}.gpx`,
        buildGpx([activity]),
        'gpx',
      );
    } catch {
      Alert.alert('Không xuất được', 'Có lỗi khi tạo tệp GPX. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!activity) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={styles.emptyText}>Không tìm thấy buổi chạy này.</Text>
        <Button label="Quay lại" variant="ghost" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const notesDirty = notesDraft !== activity.notes || feelingDraft !== activity.feeling;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Quay lại" />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activity.title}
            </Text>
            <Text style={styles.headerSub}>
              {formatFullDate(activity.startedAt)} · {formatTime(activity.startedAt)}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <IconButton
              icon={activity?.favorite ? "star" : "star-outline"}
              onPress={async () => {
                if (!activity) return;
                const next = !activity.favorite;
                await updateActivityFavorite(db, activity.id, next);
                setActivity((prev) => (prev ? { ...prev, favorite: next } : prev));
              }}
              color={activity?.favorite ? palette.accent : palette.textDim}
              accessibilityLabel={activity?.favorite ? "Bỏ yêu thích" : "Yêu thích"}
            />
            <IconButton
              icon="share-outline"
              onPress={() => setShareOpen(true)}
              accessibilityLabel="Chia sẻ"
            />
            <IconButton
              icon="trash-outline"
              onPress={onDelete}
              color={palette.textFaint}
              accessibilityLabel="Xoá buổi chạy"
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.mapWrap}>
          {region ? (
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={region}
              pointerEvents="none"
              userInterfaceStyle="dark"
              pitchEnabled={false}
              rotateEnabled={false}
              showsCompass={false}
              toolbarEnabled={false}
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
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapFallbackText}>Không có dữ liệu lộ trình</Text>
            </View>
          )}
        </View>

        <View style={styles.hero}>
          <Eyebrow>Quãng đường</Eyebrow>
          <View style={styles.heroLine}>
            <Text style={styles.heroNumber}>{u.dist(activity.distanceM)}</Text>
            <Text style={styles.heroUnit}>{u.label}</Text>
          </View>
        </View>

        <View style={styles.primaryStats}>
          <PrimaryStat label="Thời gian" value={formatDuration(activity.durationS)} />
          <View style={styles.statDivider} />
          <PrimaryStat label="Pace TB" value={u.pace(activity.avgPaceS)} suffix={u.paceLabel} />
          <View style={styles.statDivider} />
          <PrimaryStat label="Độ cao" value={u.elev(activity.elevGainM)} suffix={u.elevLabel} />
        </View>

        <View style={styles.secondaryRow}>
          <Meta label="Calo" value={`${activity.calories} kcal`} />
          <Meta label="Pace tốt nhất" value={`${u.pace(activity.bestPaceS)}${u.paceLabel}`} />
          <Meta label="Thời tiết" value={activity.weather ?? '--'} />
        </View>

        <Text style={styles.hydrationHint}>
          Sau buổi chạy nên uống khoảng {hydrationMl(
            activity.distanceM,
            Number.isFinite(parseInt(activity.weather ?? '', 10))
              ? parseInt(activity.weather ?? '', 10)
              : null,
          )}{' '}
          ml nước.
        </Text>

        <Pressable
          onPress={() => router.push('/stretch')}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Xem bài giãn cơ"
        >
          <Text style={styles.linkTextSmall}>Bài giãn cơ sau chạy</Text>
          <Ionicons name="chevron-forward" size={14} color={palette.textFaint} />
        </Pressable>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Eyebrow>{`Pace theo ${u.label}`}</Eyebrow>
            <Text style={styles.sectionHint}>cao hơn = nhanh hơn</Text>
          </View>
          <BarChart
            values={paceValues}
            labels={splits.map((s) => String(s.km))}
            height={110}
            highlightIndex={fastestSplitIndex}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Eyebrow>Hồ sơ độ cao</Eyebrow>
            <Text style={styles.sectionHint}>+{u.elev(activity.elevGainM)} {u.elevLabel}</Text>
          </View>
          <ElevationProfile route={activity.route} height={110} />
        </View>

        <View style={styles.section}>
          <Eyebrow style={{ marginBottom: 12 }}>Chia nhỏ</Eyebrow>
          <SplitsList splits={splits} />
        </View>

        {efforts ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Eyebrow>Best effort của buổi chạy</Eyebrow>
              <Text style={styles.sectionHint}>quãng liên tục nhanh nhất</Text>
            </View>
            <View style={styles.effortList}>
              {EFFORT_DISTANCES.map((distance, index) => {
                const effort = efforts[distance.key];
                return (
                  <View
                    key={distance.key}
                    style={[
                      styles.effortRow,
                      index === EFFORT_DISTANCES.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <Text style={styles.effortLabel}>{distance.label}</Text>
                    {effort ? (
                      <>
                        <Text style={styles.effortTime}>{formatDuration(effort.durationS)}</Text>
                        <Text style={styles.effortPace}>{u.pace(effort.paceSPerKm)}{u.paceLabel}</Text>
                      </>
                    ) : (
                      <Text style={styles.effortEmpty}>Chưa đủ cự ly</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Eyebrow>Loại buổi chạy</Eyebrow>
            {savingRunType ? <Text style={styles.sectionHint}>đang lưu...</Text> : null}
          </View>
          <View style={styles.runTypeRow}>
            <Pressable
              onPress={() => saveRunType(null)}
              style={({ pressed }) => [
                styles.runTypeChip,
                !runTypeDraft && styles.runTypeChipActive,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: !runTypeDraft }}
            >
              <Text
                style={[styles.runTypeChipText, !runTypeDraft && styles.runTypeChipTextActive]}
              >
                Chưa gán
              </Text>
            </Pressable>
            {RUN_TYPES.map((option) => {
              const active = runTypeDraft === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => saveRunType(option.key)}
                  style={({ pressed }) => [
                    styles.runTypeChip,
                    active && styles.runTypeChipActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.runTypeChipText, active && styles.runTypeChipTextActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.feelingHint}>
            {runTypeDraft
              ? `Đang gán: ${runTypeLabel(runTypeDraft)}`
              : 'Chọn loại để lọc và so sánh về sau'}
          </Text>
        </View>

        {gearList.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Eyebrow>Giày & thiết bị</Eyebrow>
              {savingGear ? <Text style={styles.sectionHint}>đang lưu...</Text> : null}
            </View>
            <View style={styles.runTypeRow}>
              <Pressable
                onPress={async () => {
                  if (!activity) return;
                  setSavingGear(true);
                  try {
                    await updateActivityGear(db, activity.id, null);
                    setActivity((prev) => (prev ? { ...prev, gearId: null } : prev));
                  } finally {
                    setSavingGear(false);
                  }
                }}
                style={({ pressed }) => [
                  styles.runTypeChip,
                  !activity?.gearId && styles.runTypeChipActive,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: !activity?.gearId }}
              >
                <Text
                  style={[
                    styles.runTypeChipText,
                    !activity?.gearId && styles.runTypeChipTextActive,
                  ]}
                >
                  Không gán
                </Text>
              </Pressable>
              {gearList.map((item) => {
                const active = activity?.gearId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={async () => {
                      if (!activity) return;
                      setSavingGear(true);
                      try {
                        await updateActivityGear(db, activity.id, item.id);
                        await recomputeGearDistance(db, item.id);
                        if (activity.gearId && activity.gearId !== item.id) {
                          await recomputeGearDistance(db, activity.gearId);
                        }
                        setActivity((prev) => (prev ? { ...prev, gearId: item.id } : prev));
                      } finally {
                        setSavingGear(false);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.runTypeChip,
                      active && styles.runTypeChipActive,
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[styles.runTypeChipText, active && styles.runTypeChipTextActive]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {consistency ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Eyebrow>Độ đều pace</Eyebrow>
              <Text style={styles.sectionHint}>{consistency.label}</Text>
            </View>
            <View style={styles.consistencyCard}>
              <Text style={styles.consistencyScore}>{consistency.score}</Text>
              <Text style={styles.consistencyUnit}>/100</Text>
              <View style={styles.consistencyMeta}>
                <Text style={styles.consistencyLine}>
                  Pace TB {u.pace(consistency.meanS)}{u.paceLabel}
                </Text>
                <Text style={styles.consistencyLine}>
                  Chênh lệch {u.pace(consistency.spreadS)} · CV{' '}
                  {(consistency.cv * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {previousActivity ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Eyebrow>So với buổi trước</Eyebrow>
              <Text style={styles.sectionHint}>
                {formatDayLabel(previousActivity.startedAt)}
              </Text>
            </View>
            <View style={styles.compareCard}>
              <CompareRow
                label="Quãng đường"
                current={`${u.dist(activity.distanceM)} ${u.label}`}
                previous={`${u.dist(previousActivity.distanceM)} ${u.label}`}
                delta={deltaPct(activity.distanceM, previousActivity.distanceM)}
                unit="%"
              />
              <CompareRow
                label="Pace TB"
                current={`${u.pace(activity.avgPaceS)}${u.paceLabel}`}
                previous={`${u.pace(previousActivity.avgPaceS)}${u.paceLabel}`}
                deltaSeconds={
                  activity.avgPaceS != null && previousActivity.avgPaceS != null
                    ? activity.avgPaceS - previousActivity.avgPaceS
                    : null
                }
              />
              <CompareRow
                label="Độ cao"
                current={`${u.elev(activity.elevGainM)} ${u.elevLabel}`}
                previous={`${u.elev(previousActivity.elevGainM)} ${u.elevLabel}`}
                delta={deltaPct(activity.elevGainM, previousActivity.elevGainM)}
                unit="%"
                last
              />
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/activity/[id]', params: { id: previousActivity.id } })
                }
                style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Xem buổi chạy trước"
              >
                <Text style={styles.linkTextSmall}>Xem buổi chạy trước</Text>
                <Ionicons name="chevron-forward" size={14} color={palette.textFaint} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Eyebrow>Cảm nhận buổi chạy</Eyebrow>
            {notesDirty ? <Text style={styles.sectionHint}>chưa lưu</Text> : null}
          </View>

          <View style={styles.feelingRow}>
            {FEELINGS.map((option) => {
              const active = feelingDraft === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFeelingDraft(active ? null : option.value)}
                  style={({ pressed }) => [
                    styles.feelingChip,
                    active && styles.feelingChipActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.label}
                >
                  <Text style={styles.feelingEmoji}>{option.emoji}</Text>
                  <Text
                    style={[styles.feelingLabel, active && styles.feelingLabelActive]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.feelingHint}>
            {feelingDraft
              ? 'Chạm lại để bỏ chọn · cảm nhận được lưu cùng ghi chú'
              : 'Chạm một biểu tượng để chọn cảm nhận'}
          </Text>

          <TextInput
            value={notesDraft}
            onChangeText={setNotesDraft}
            placeholder="Hôm nay chạy thế nào? Ghi lại cảm giác, thời tiết, nhịp thở..."
            placeholderTextColor={palette.textFaint}
            style={styles.notesInput}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            selectionColor={palette.accent}
          />

          <View style={styles.notesFooter}>
            <Text style={styles.notesCount}>{notesDraft.length}/2000</Text>
            <Button
              label={savingNotes ? 'Đang lưu...' : 'Lưu ghi chú'}
              variant={notesDirty ? 'primary' : 'ghost'}
              onPress={saveNotes}
              disabled={savingNotes || !notesDirty}
              style={styles.notesButton}
            />
          </View>
        </View>

        <Button
          label="Tạo ảnh chia sẻ"
          icon="share-outline"
          onPress={() => setShareOpen(true)}
          style={styles.shareButton}
        />

        <View style={styles.actionRow}>
          <Button
            label={exporting ? 'Đang xuất...' : 'Xuất GPX'}
            icon="download-outline"
            variant="ghost"
            onPress={onExportGpx}
            disabled={exporting || activity.route.length < 2}
            style={styles.actionButton}
          />
          <Button
            label="Đổi tên"
            icon="create-outline"
            variant="ghost"
            onPress={openRename}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>

      <Modal
        visible={shareOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setShareOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareOpen(false)} />

          <View style={styles.variantRow}>
            {CARD_VARIANTS.map((option) => {
              const active = cardVariant === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setCardVariant(option.key)}
                  style={({ pressed }) => [
                    styles.variantChip,
                    active && styles.variantChipActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.variantText, active && styles.variantTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.modalCard}>
            <ShareCard
              activity={activity}
              width={300}
              cardRef={cardRef}
              variant={cardVariant}
            />
          </View>

          <View style={styles.modalActions}>
            <Button
              label={sharing ? 'Đang tạo...' : 'Chia sẻ'}
              icon="share"
              onPress={onShare}
              disabled={sharing}
              style={{ flex: 1 }}
            />
            <Button
              label="Đóng"
              variant="ghost"
              onPress={() => setShareOpen(false)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={renameOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setRenameOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.renameBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRenameOpen(false)} />

          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Đổi tên buổi chạy</Text>
            <TextInput
              value={titleDraft}
              onChangeText={setTitleDraft}
              placeholder="Ví dụ: Chạy dài Chủ nhật"
              placeholderTextColor={palette.textFaint}
              style={styles.renameInput}
              maxLength={60}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveRename}
              selectionColor={palette.accent}
            />
            <View style={styles.renameActions}>
              <Button
                label="Huỷ"
                variant="ghost"
                onPress={() => setRenameOpen(false)}
                style={styles.renameButton}
              />
              <Button label="Lưu" onPress={saveRename} style={styles.renameButton} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function PrimaryStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.primaryStat}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <View style={styles.statValueLine}>
        <Text style={styles.statValue}>{value}</Text>
        {suffix ? <Text style={styles.statSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function CompareRow({
  label,
  current,
  previous,
  delta,
  deltaSeconds,
  unit,
  last,
}: {
  label: string;
  current: string;
  previous: string;
  delta?: number;
  deltaSeconds?: number | null;
  unit?: string;
  last?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  let deltaText = '--';
  let deltaColor: string = palette.textFaint;
  if (deltaSeconds != null) {
    const sign = deltaSeconds > 0 ? '+' : '';
    deltaText = `${sign}${Math.round(deltaSeconds)}s`;
    deltaColor = deltaSeconds <= 0 ? palette.accent : palette.danger;
  } else if (delta != null && Number.isFinite(delta)) {
    const sign = delta > 0 ? '+' : '';
    deltaText = `${sign}${Math.round(delta)}${unit ?? ''}`;
    deltaColor = delta >= 0 ? palette.accent : palette.danger;
    if (label === 'Pace TB') deltaColor = delta <= 0 ? palette.accent : palette.danger;
  }

  return (
    <View style={[styles.compareRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.compareLabel}>{label}</Text>
      <View style={styles.compareValues}>
        <Text style={styles.compareCurrent}>{current}</Text>
        <Text style={styles.comparePrevious}>{previous}</Text>
      </View>
      <Text style={[styles.compareDelta, { color: deltaColor }]}>{deltaText}</Text>
    </View>
  );
}

function deltaPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  safeTop: { backgroundColor: c.bg },
  loading: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  emptyText: { color: c.textDim, fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  mapWrap: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapFallbackText: { color: c.textFaint, fontSize: 13 },
  hero: { marginTop: 24 },
  heroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  heroNumber: {
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '800',
    letterSpacing: -3.4,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: { fontSize: 19, fontWeight: '700', color: c.accent },
  primaryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  primaryStat: { flex: 1 },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: c.textFaint,
    marginBottom: 5,
  },
  statValueLine: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: {
    fontSize: 21,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statSuffix: { fontSize: 10, color: c.textFaint },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: c.border,
    marginHorizontal: 12,
  },
  secondaryRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 10,
  },
  metaItem: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  metaLabel: { fontSize: 10, color: c.textFaint, marginBottom: 4 },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  section: { marginTop: 30 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHint: { fontSize: 10, color: c.textFaint },
  effortList: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    paddingHorizontal: 14,
  },
  effortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  effortLabel: {
    width: 58,
    fontSize: 12,
    fontWeight: '700',
    color: c.textDim,
    letterSpacing: 0.3,
  },
  effortTime: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  effortPace: {
    fontSize: 11,
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  effortEmpty: { flex: 1, fontSize: 11, color: c.textFaint },
  runTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  runTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  runTypeChipActive: { backgroundColor: c.accentSoft, borderColor: c.accentLine },
  runTypeChipText: { fontSize: 11, fontWeight: '600', color: c.textDim },
  runTypeChipTextActive: { color: c.accent },
  consistencyCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 16,
  },
  consistencyScore: {
    fontSize: 34,
    fontWeight: '800',
    color: c.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.4,
  },
  consistencyUnit: { fontSize: 13, color: c.textFaint, fontWeight: '600' },
  consistencyMeta: { flex: 1, marginLeft: 10, gap: 4 },
  consistencyLine: { fontSize: 11, color: c.textDim },
  compareCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    paddingHorizontal: 14,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    gap: 8,
  },
  compareLabel: { flex: 1.1, fontSize: 12, color: c.textDim, fontWeight: '600' },
  compareValues: { flex: 1.4, alignItems: 'flex-end' },
  compareCurrent: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  comparePrevious: { fontSize: 10, color: c.textFaint, marginTop: 2 },
  compareDelta: {
    width: 64,
    alignItems: 'flex-end',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  linkTextSmall: { fontSize: 12, color: c.textDim, fontWeight: '600' },
  hydrationHint: { marginTop: 10, fontSize: 11, color: c.textFaint },
  feelingRow: { flexDirection: 'row', gap: 8 },
  feelingChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  feelingChipActive: { backgroundColor: c.accentSoft, borderColor: c.accentLine },
  feelingEmoji: { fontSize: 20 },
  feelingLabel: {
    marginTop: 5,
    fontSize: 8,
    fontWeight: '600',
    color: c.textFaint,
  },
  feelingLabelActive: { color: c.accent },
  feelingHint: { marginTop: 8, fontSize: 11, color: c.textFaint },
  notesInput: {
    marginTop: 12,
    minHeight: 96,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    lineHeight: 20,
    color: c.text,
  },
  notesFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  notesCount: {
    fontSize: 10,
    color: c.textFaint,
    fontVariant: ['tabular-nums'],
  },
  notesButton: { minWidth: 132 },
  shareButton: { marginTop: 34 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionButton: { flex: 1 },
  variantRow: { flexDirection: 'row', gap: 8 },
  variantChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  variantChipActive: { backgroundColor: c.accentSoft, borderColor: c.accentLine },
  variantText: { fontSize: 11, fontWeight: '600', color: c.textDim },
  variantTextActive: { color: c.accent },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  modalCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  modalActions: { flexDirection: 'row', gap: 10, width: '100%' },
  renameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  renameCard: {
    backgroundColor: c.bgElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 20,
    gap: 14,
  },
  renameTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.3,
  },
  renameInput: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.text,
  },
  renameActions: { flexDirection: 'row', gap: 10 },
  renameButton: { flex: 1 },
});
