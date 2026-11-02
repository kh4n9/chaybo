import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/lib/theme';

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
          color={focused ? colors.accent : colors.textFaint}
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
          <Ionicons name="play" size={26} color={colors.bg} style={styles.playIcon} />
        </View>
        <Text style={styles.centerLabel}>Chạy</Text>
      </Pressable>

      {routes.slice(splitAt).map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: colors.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
    color: colors.textFaint,
  },
  labelActive: { color: colors.accent },
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
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.bgElevated,
    shadowColor: colors.accent,
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
    color: colors.textDim,
  },
});
