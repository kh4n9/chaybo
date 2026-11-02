import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Divider, Eyebrow, IconButton } from '@/components/ui';
import {
  deleteAllActivities,
  listAllActivities,
  restoreActivities,
  saveActivity,
} from '@/db/activities';
import {
  FREEZE_RANGE,
  GOAL_RANGE,
  MONTH_GOAL_RANGE,
  WEIGHT_RANGE,
  YEAR_GOAL_RANGE,
  type AppSettings,
} from '@/db/settings';
import { useActivities } from '@/hooks/useActivities';
import { useSettings } from '@/hooks/useSettings';
import { deleteGear, listGear, saveGear, type Gear } from '@/db/gear';
import {
  BackupError,
  buildBackup,
  parseBackup,
  type RestoredBackup,
} from '@/lib/backup';
import {
  buildGpx,
  buildTcx,
  exportFileName,
  shareTextFile,
  type ExportKind,
} from '@/lib/export';
import { startOfWeek, metersToUnit, unitToMeters } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { GpxError, parseGpx, splitDuplicateTracks, type ImportedGpxTrack } from '@/lib/gpx';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';
import { PLAN_GOALS, PLAN_LEVELS, toPlanGoal, toPlanLevel } from '@/lib/trainingPlan';

type BusyKind = ExportKind | 'clear' | 'restore' | 'gpx-import';

export default function SettingsScreen() {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const router = useRouter();
  const db = useSQLiteContext();
  const { settings, update } = useSettings();
  const { activities, refresh, fetchedAt } = useActivities();
  const [busy, setBusy] = useState<BusyKind | null>(null);

  const weekDistanceM = useMemo(() => {
    if (!fetchedAt) return 0;
    const from = startOfWeek(fetchedAt);
    return activities
      .filter((activity) => activity.startedAt >= from)
      .reduce((sum, activity) => sum + activity.distanceM, 0);
  }, [activities, fetchedAt]);

  const goalPct =
    settings.weeklyGoalKm > 0
      ? Math.min(1, weekDistanceM / (settings.weeklyGoalKm * 1000))
      : 0;

  // Goals are stored in km; the steppers show the unit chosen in settings.
  const goalToDisplay = (km: number) => Math.round(metersToUnit(km * 1000, u.unit));
  const goalFromDisplay = (value: number) => Math.round(unitToMeters(value, u.unit) / 1000);

  const onExport = async (kind: ExportKind) => {
    setBusy(kind);
    try {
      const all = await listAllActivities(db);
      if (all.length === 0) {
        Alert.alert('Chưa có dữ liệu', 'Hãy ghi ít nhất một buổi chạy trước khi xuất.');
        return;
      }

      if (kind === 'gpx') {
        await shareTextFile(exportFileName('chaybo', 'gpx'), buildGpx(all), 'gpx');
      } else if (kind === 'tcx') {
        await shareTextFile(exportFileName('chaybo', 'tcx'), buildTcx(all), 'tcx');
      } else {
        await shareTextFile(
          exportFileName('chaybo-backup', 'json'),
          buildBackup(all, { ...settings, lastBackupAt: Date.now() }),
          'json',
        );
        await update({ lastBackupAt: Date.now() });
      }
    } catch {
      Alert.alert('Không xuất được', 'Có lỗi khi tạo tệp. Vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  };

  const onClearAll = () => {
    if (activities.length === 0) return;

    Alert.alert(
      'Xoá toàn bộ dữ liệu?',
      `${activities.length} buổi chạy sẽ bị xoá vĩnh viễn khỏi máy. Hãy sao lưu (.json) trước nếu bạn cần giữ lại.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá tất cả',
          style: 'destructive',
          onPress: async () => {
            setBusy('clear');
            try {
              await deleteAllActivities(db);
              await refresh();
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const applyRestore = async (backup: RestoredBackup) => {
    setBusy('restore');
    try {
      if (backup.activities.length > 0) {
        await restoreActivities(db, backup.activities);
      }
      if (backup.settings) {
        await update(backup.settings);
      }
      await refresh();
      Alert.alert(
        'Đã khôi phục',
        backup.activities.length > 0
          ? `${backup.activities.length} buổi chạy đã được thêm vào máy.`
          : 'Đã cập nhật cài đặt từ tệp sao lưu.',
      );
    } catch {
      Alert.alert('Không khôi phục được', 'Có lỗi khi ghi dữ liệu. Vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    let backup: RestoredBackup | null = null;

    setBusy('restore');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      if (!asset) return;

      const text = await new File(asset.uri).text();
      backup = parseBackup(text);
    } catch (error) {
      if (error instanceof BackupError) {
        Alert.alert('Tệp không hợp lệ', error.message);
      } else {
        Alert.alert('Không đọc được tệp', 'Hãy chọn tệp .json được tạo từ chaybo.');
      }
      return;
    } finally {
      setBusy(null);
    }

    if (!backup) return;

    const count = backup.activities.length;
    if (count === 0 && !backup.settings) {
      Alert.alert('Tệp trống', 'Tệp sao lưu không có buổi chạy hay cài đặt nào.');
      return;
    }

    const target = backup;
    Alert.alert(
      'Khôi phục từ tệp sao lưu?',
      count > 0
        ? `${count} buổi chạy sẽ được thêm vào máy. Buổi chạy trùng mã sẽ bị ghi đè.`
        : 'Cài đặt trong tệp sẽ thay thế cài đặt hiện tại.',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Khôi phục',
          onPress: () => {
            void applyRestore(target);
          },
        },
      ],
    );
  };

  const applyGpxImport = async (tracks: ImportedGpxTrack[]) => {
    setBusy('gpx-import');
    try {
      const { unique, duplicates } = splitDuplicateTracks(tracks, activities);
      if (unique.length === 0) {
        Alert.alert(
          'Đã có trong lịch sử',
          `${duplicates.length} buổi chạy trùng với dữ liệu hiện có, không có gì mới để nhập.`,
        );
        return;
      }
      for (const track of unique) {
        await saveActivity(db, track);
      }
      await refresh();
      Alert.alert(
        'Đã nhập',
        duplicates.length > 0
          ? `${unique.length} buổi chạy mới đã được thêm · ${duplicates.length} trùng bị bỏ qua.`
          : unique.length === 1
            ? 'Buổi chạy đã được thêm vào lịch sử.'
            : `${unique.length} buổi chạy đã được thêm vào lịch sử.`,
      );
    } catch {
      Alert.alert('Không nhập được', 'Có lỗi khi ghi dữ liệu. Vui lòng thử lại.');
    } finally {
      setBusy(null);
    }
  };

  const onImportGpx = async () => {
    let tracks: ImportedGpxTrack[] = [];

    setBusy('gpx-import');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // GPX files have inconsistent MIME types across apps, so accept any
        // file and validate the content instead of filtering by type.
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      if (!asset) return;

      const text = await new File(asset.uri).text();
      tracks = parseGpx(text, settings.weightKg);
    } catch (error) {
      if (error instanceof GpxError) {
        Alert.alert('Không đọc được GPX', error.message);
      } else {
        Alert.alert(
          'Không đọc được tệp',
          'Hãy chọn tệp .gpx có toạ độ và thời gian, ví dụ tệp xuất từ Strava hoặc Garmin.',
        );
      }
      return;
    } finally {
      setBusy(null);
    }

    if (tracks.length === 0) return;

    const totalKm = tracks.reduce((sum, track) => sum + track.distanceM, 0) / 1000;
    const target = tracks;
    Alert.alert(
      tracks.length === 1 ? 'Nhập buổi chạy này?' : `Nhập ${tracks.length} buổi chạy?`,
      `${u.dist(totalKm * 1000, 1)} ${u.label} · ${tracks[0].title}`,
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Nhập',
          onPress: () => {
            void applyGpxImport(target);
          },
        },
      ],
    );
  };

  const setSetting = (patch: Partial<AppSettings>) => {
    void update(patch);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';
  const empty = activities.length === 0;

  const [gear, setGear] = useState<Gear[]>([]);
  const [newGearName, setNewGearName] = useState('');
  const [addingGear, setAddingGear] = useState(false);

  const refreshGear = async () => {
    setGear(await listGear(db));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await listGear(db);
      if (!cancelled) setGear(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Đóng cài đặt" />
        <Text style={styles.headerTitle}>Cài đặt</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Giao diện &amp; đơn vị">
          <View style={styles.card}>
            <Text style={styles.choiceLabel}>Chủ đề</Text>
            <ChoiceRow
              options={[
                { key: 'dark', label: 'Tối', hint: 'Nền đen, chữ sáng' },
                { key: 'light', label: 'Sáng', hint: 'Nền giấy, chữ mực' },
              ]}
              value={settings.theme}
              onChange={(key) => setSetting({ theme: key === 'light' ? 'light' : 'dark' })}
            />

            <Text style={[styles.choiceLabel, styles.choiceLabelSpaced]}>Đơn vị</Text>
            <ChoiceRow
              options={[
                { key: 'km', label: 'Kilômét', hint: 'km · m' },
                { key: 'mi', label: 'Dặm', hint: 'mi · ft' },
              ]}
              value={settings.units}
              onChange={(key) => setSetting({ units: key === 'mi' ? 'mi' : 'km' })}
            />
          </View>
        </Section>

        <Section title="Chạy bộ">
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Huấn luyện viên giọng nói</Text>
                <Text style={styles.toggleHint}>
                  Đọc to quãng đường và pace mỗi khi qua mốc 1 km (chỉ khi đang ghi).
                </Text>
              </View>
              <Switch
                value={settings.voiceCoach}
                onValueChange={(voiceCoach) => setSetting({ voiceCoach })}
                trackColor={{ false: palette.border, true: palette.accentFill }}
                thumbColor={palette.surface}
              />
            </View>
          </View>
        </Section>

        <Section title="Cá nhân">
          <View style={styles.card}>
            <NumberRow
              label="Cân nặng"
              hint="Dùng để ước lượng calo"
              value={settings.weightKg}
              unit="kg"
              min={WEIGHT_RANGE.min}
              max={WEIGHT_RANGE.max}
              onChange={(weightKg) => setSetting({ weightKg })}
            />
          </View>
        </Section>

        <Section title="Mục tiêu tuần">
          <View style={styles.card}>
            <NumberRow
              label="Quãng đường"
              hint="0 = tắt mục tiêu"
              value={goalToDisplay(settings.weeklyGoalKm)}
              unit={u.label}
              min={0}
              max={goalToDisplay(GOAL_RANGE.max)}
              step={u.unit === 'mi' ? 1 : 5}
              onChange={(value) => setSetting({ weeklyGoalKm: goalFromDisplay(value) })}
            />

            {settings.weeklyGoalKm > 0 ? (
              <View style={styles.goal}>
                <View style={styles.goalTrack}>
                  <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
                </View>
                <View style={styles.goalLabels}>
                  <Text style={styles.goalDone}>
                    {u.dist(weekDistanceM, 1)} {u.label} tuần này
                  </Text>
                  <Text style={styles.goalTarget}>{Math.round(goalPct * 100)}%</Text>
                </View>
              </View>
            ) : null}
          </View>
        </Section>

        <Section title="Mục tiêu tháng &amp; năm">
          <View style={styles.card}>
            <NumberRow
              label="Mỗi tháng"
              hint="0 = tắt mục tiêu"
              value={goalToDisplay(settings.monthlyGoalKm)}
              unit={u.label}
              min={0}
              max={goalToDisplay(MONTH_GOAL_RANGE.max)}
              step={u.unit === 'mi' ? 3 : 5}
              onChange={(value) => setSetting({ monthlyGoalKm: goalFromDisplay(value) })}
            />
            <Divider />
            <NumberRow
              label="Mỗi năm"
              hint="0 = tắt mục tiêu"
              value={goalToDisplay(settings.yearlyGoalKm)}
              unit={u.label}
              min={0}
              max={goalToDisplay(YEAR_GOAL_RANGE.max)}
              step={u.unit === 'mi' ? 5 : 10}
              onChange={(value) => setSetting({ yearlyGoalKm: goalFromDisplay(value) })}
            />
          </View>
        </Section>

        <Section title="Chuỗi ngày">
          <View style={styles.card}>
            <NumberRow
              label="Ngày bảo lưu"
              hint="Số ngày nghỉ được phép mà chuỗi không đứt"
              value={settings.streakFreezes}
              unit="ngày"
              min={FREEZE_RANGE.min}
              max={FREEZE_RANGE.max}
              onChange={(streakFreezes) => setSetting({ streakFreezes })}
            />
          </View>
        </Section>

        <Section title="Kế hoạch tập">
          <View style={styles.card}>
            <Text style={styles.choiceLabel}>Mục tiêu</Text>
            <ChoiceRow
              options={PLAN_GOALS.map((goal) => ({ key: goal.key, label: goal.short }))}
              value={settings.planGoal}
              onChange={(key) => setSetting({ planGoal: toPlanGoal(key) })}
            />

            <Text style={[styles.choiceLabel, styles.choiceLabelSpaced]}>Trình độ</Text>
            <ChoiceRow
              options={PLAN_LEVELS.map((level) => ({
                key: level.key,
                label: level.label,
                hint: level.hint,
              }))}
              value={settings.planLevel}
              onChange={(key) => setSetting({ planLevel: toPlanLevel(key) })}
            />

            <Divider style={styles.choiceDivider} />
            <ActionRow
              icon="calendar-outline"
              label="Bắt đầu lại từ tuần này"
              hint={
                settings.planStartAt
                  ? `Đang bắt đầu ${formatShortDate(settings.planStartAt)} · đổi mục tiêu sẽ áp dụng ngay`
                  : 'Chưa đặt ngày bắt đầu'
              }
              onPress={() => setSetting({ planStartAt: startOfWeek(fetchedAt ?? Date.now()) })}
              disabled={false}
            />
          </View>
        </Section>

        <Section title="Dữ liệu">
          <View style={styles.card}>
            <ActionRow
              icon="navigate-outline"
              label="Xuất tất cả (.gpx)"
              hint="Mở được trên Strava, Garmin Connect"
              onPress={() => onExport('gpx')}
              loading={busy === 'gpx'}
              disabled={empty || busy !== null}
            />
            <Divider />
            <ActionRow
              icon="document-outline"
              label="Xuất tất cả (.tcx)"
              hint="Garmin Training Center"
              onPress={() => onExport('tcx')}
              loading={busy === 'tcx'}
              disabled={empty || busy !== null}
            />
            <Divider />
            <ActionRow
              icon="document-text-outline"
              label="Sao lưu (.json)"
              hint={
                settings.lastBackupAt
                  ? `Lần cuối: ${new Date(settings.lastBackupAt).getDate()}/${new Date(settings.lastBackupAt).getMonth() + 1}/${new Date(settings.lastBackupAt).getFullYear()}`
                  : 'Toàn bộ buổi chạy và cài đặt'
              }
              onPress={() => onExport('json')}
              loading={busy === 'json'}
              disabled={empty || busy !== null}
            />
            <Divider />
            <ActionRow
              icon="navigate-circle-outline"
              label="Nhập từ .gpx"
              hint="Mang buổi chạy từ Strava, Garmin, Apple Watch"
              onPress={onImportGpx}
              loading={busy === 'gpx-import'}
              disabled={busy !== null}
            />
            <Divider />
            <ActionRow
              icon="folder-open-outline"
              label="Khôi phục từ .json"
              hint="Nhập lại tệp sao lưu đã xuất"
              onPress={onRestore}
              loading={busy === 'restore'}
              disabled={busy !== null}
            />
            <Divider />
            <ActionRow
              icon="trash-outline"
              label="Xoá toàn bộ dữ liệu"
              hint={empty ? 'Chưa có buổi chạy nào' : `${activities.length} buổi chạy trên máy`}
              onPress={onClearAll}
              loading={busy === 'clear'}
              disabled={empty || busy !== null}
              danger
            />
          </View>
        </Section>

        <Section title="Giày & thiết bị">
          <View style={styles.card}>
            <View style={styles.gearInputRow}>
              <TextInput
                value={newGearName}
                onChangeText={setNewGearName}
                placeholder="Tên giày, ví dụ: Nike Pegasus 41"
                placeholderTextColor={palette.textFaint}
                style={styles.gearInput}
                maxLength={60}
              />
              <Pressable
                onPress={async () => {
                  if (newGearName.trim().length === 0) return;
                  setAddingGear(true);
                  try {
                    await saveGear(db, newGearName);
                    setNewGearName('');
                    await refreshGear();
                  } finally {
                    setAddingGear(false);
                  }
                }}
                disabled={addingGear || newGearName.trim().length === 0}
                style={({ pressed }) => [
                  styles.gearAddButton,
                  pressed && { opacity: 0.7 },
                  (addingGear || newGearName.trim().length === 0) && { opacity: 0.4 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Thêm giày"
              >
                <Ionicons name="add" size={18} color={palette.bg} />
              </Pressable>
            </View>
            {gear.length === 0 ? (
              <Text style={styles.gearEmpty}>Chưa có thiết bị nào. Thêm để theo dõi quãng đường từng đôi.</Text>
            ) : (
              gear.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <Divider /> : null}
                  <View style={styles.gearRow}>
                    <View style={styles.gearInfo}>
                      <Text style={styles.gearName}>{item.name}</Text>
                      <Text style={styles.gearMeta}>
                        {u.dist(item.totalDistanceM, 1)} {u.label} đã chạy
                      </Text>
                    </View>
                    <Pressable
                      onPress={async () => {
                        await deleteGear(db, item.id);
                        await refreshGear();
                        await refresh();
                      }}
                      style={({ pressed }) => [styles.gearDelete, pressed && { opacity: 0.6 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Xoá ${item.name}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={palette.danger} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>
            chaybo<Text style={{ color: palette.accent }}>.</Text> v{version}
          </Text>
          <Text style={styles.footerBody}>
            Dữ liệu chỉ nằm trên chiếc iPhone này, không có tài khoản và không gửi lên máy chủ.
            Xoá app là mất dữ liệu, nên hãy sao lưu định kỳ.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatShortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Eyebrow style={styles.sectionTitle}>{title}</Eyebrow>
      {children}
    </View>
  );
}

function NumberRow({
  label,
  hint,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.numberRow}>
      <View style={styles.numberText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>

      <View style={styles.stepper}>
        <StepButton
          icon="remove"
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          accessibilityLabel={`Giảm ${label}`}
        />
        <View style={styles.stepperValue}>
          <Text style={styles.stepperNumber}>{value}</Text>
          <Text style={styles.stepperUnit}>{unit}</Text>
        </View>
        <StepButton
          icon="add"
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          accessibilityLabel={`Tăng ${label}`}
        />
      </View>
    </View>
  );
}

function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; hint?: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.choiceChip,
              active && styles.choiceChipActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.choiceChipLabel, active && styles.choiceChipLabelActive]}>
              {option.label}
            </Text>
            {option.hint ? (
              <Text style={[styles.choiceChipHint, active && styles.choiceChipHintActive]}>
                {option.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        styles.stepButton,
        pressed && { opacity: 0.6 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Ionicons name={icon} size={16} color={palette.text} />
    </Pressable>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onPress,
  loading,
  disabled,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const tint = danger ? palette.danger : palette.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.65 }]}
    >
      <View style={[styles.actionIcon, danger && { backgroundColor: palette.dangerSoft }]}>
        <Ionicons name={icon} size={17} color={danger ? palette.danger : palette.textDim} />
      </View>

      <View style={styles.actionText}>
        <Text style={[styles.actionLabel, { color: tint }, disabled && { opacity: 0.45 }]}>
          {label}
        </Text>
        <Text style={styles.actionHint}>{hint}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={palette.textDim} size="small" />
      ) : (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={palette.textFaint}
          style={disabled ? { opacity: 0.4 } : undefined}
        />
      )}
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  section: { marginBottom: 26 },
  sectionTitle: { marginBottom: 10, marginLeft: 2 },
  choiceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: c.textFaint,
    paddingTop: 14,
  },
  choiceLabelSpaced: { paddingTop: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  toggleText: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: c.text },
  toggleHint: { fontSize: 12, color: c.textDim, marginTop: 2, lineHeight: 16 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingTop: 8 },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    alignItems: 'center',
  },
  choiceChipActive: { backgroundColor: c.accentSoft, borderColor: c.accentLine },
  choiceChipLabel: { fontSize: 12, fontWeight: '700', color: c.textDim },
  choiceChipLabelActive: { color: c.accent },
  choiceChipHint: { fontSize: 9, color: c.textFaint, marginTop: 1 },
  choiceChipHintActive: { color: c.accentLine },
  choiceDivider: { marginTop: 16 },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    paddingHorizontal: 16,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  numberText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: c.text },
  rowHint: { fontSize: 11, color: c.textFaint, marginTop: 3 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.bgElevated,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  stepperValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 3,
    minWidth: 58,
  },
  stepperNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  stepperUnit: { fontSize: 10, color: c.textFaint, fontWeight: '600' },
  goal: { paddingBottom: 16, gap: 8 },
  goalTrack: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  goalFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.accent },
  goalLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  goalDone: { fontSize: 11, color: c.textDim },
  goalTarget: {
    fontSize: 11,
    fontWeight: '700',
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { flex: 1 },
  actionLabel: { fontSize: 14, fontWeight: '600' },
  actionHint: { fontSize: 11, color: c.textFaint, marginTop: 3 },
  gearInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 },
  gearInput: {
    flex: 1,
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: c.text,
  },
  gearAddButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearEmpty: { fontSize: 12, color: c.textFaint, paddingVertical: 12 },
  gearRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  gearInfo: { flex: 1 },
  gearName: { fontSize: 14, fontWeight: '600', color: c.text },
  gearMeta: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  gearDelete: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { marginTop: 6, paddingHorizontal: 4 },
  footerTitle: { fontSize: 13, fontWeight: '700', color: c.textDim },
  footerBody: { fontSize: 12, lineHeight: 18, color: c.textFaint, marginTop: 6 },
});
