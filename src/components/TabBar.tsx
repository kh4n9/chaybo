import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';

const LABELS: Record<string, string> = {
  index: 'Lịch sử',
  stats: 'Thống kê',
};

const ICONS: Record<
  string,
  { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }
> = {
  index: { active: 'time', idle: 'time-outline' },
  stats: { active: 'stats-chart', idle: 'stats-chart-outline' },
};

/** Left-to-right order of the real tabs; the record button sits between them. */
const TAB_ORDER = ['index', 'stats'];

export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const focusedKey = state.routes[state.index]?.key;
  const routes = [...state.routes].sort(
    (a, b) => TAB_ORDER.indexOf(a.name) - TAB_ORDER.indexOf(b.name),
  );
  const splitAt = Math.ceil(routes.length / 2);

  const renderTab = (route: (typeof routes)[number]) => {
    const focused = focusedKey === route.key;
    const icons = ICONS[route.name] ?? ICONS.index;
    const label = LABELS[route.name] ?? route.name;

    return (
      <Pressable
        key={route.key}
        onPress={() => navigateToTab(route.key)}
        style={styles.slot}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={label}
      >
        <Ionicons
          name={focused ? icons.active : icons.idle}
          size={22}
          color={focused ? palette.accent : palette.textFaint}
        />
        <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {routes.slice(0, splitAt).map(renderTab)}

      <Pressable
        onPress={() => router.push('/record')}
        style={styles.centerSlot}
        accessibilityRole="button"
        accessibilityLabel="Bắt đầu ghi buổi chạy"
      >
        <View style={styles.centerButton}>
          <Ionicons name="play" size={26} color={palette.bg} style={styles.playIcon} />
        </View>
        <Text style={styles.centerLabel}>Chạy</Text>
      </Pressable>

      {routes.slice(splitAt).map(renderTab)}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: c.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: c.textFaint,
  },
  labelActive: { color: c.accent },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    marginTop: -26,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: c.bgElevated,
    shadowColor: c.accent,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  playIcon: { marginLeft: 3 },
  centerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: c.textDim,
  },
});
