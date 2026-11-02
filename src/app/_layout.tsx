import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { DATABASE_NAME, migrateDbIfNeeded } from '@/db';
import { SettingsProvider } from '@/hooks/useSettings';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <Suspense fallback={<BootScreen />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
        <SettingsProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="activity/[id]" />
            <Stack.Screen name="records" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="stretch" />
            <Stack.Screen name="plan" />
            <Stack.Screen name="interval" />
            <Stack.Screen name="segments" />
            <Stack.Screen name="recovery" />
            <Stack.Screen
              name="settings"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="record"
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                gestureEnabled: false,
              }}
            />
          </Stack>
        </SettingsProvider>
      </SQLiteProvider>
    </Suspense>
  );
}

function BootScreen() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
