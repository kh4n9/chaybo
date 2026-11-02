import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';

type Props = { children: React.ReactNode };

export function BiometricGate({ children }: Props) {
  const { settings } = useSettings();
  const { colors } = useTheme();
  const [unlocked, setUnlocked] = useState(!settings.biometricLock);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!settings.biometricLock) {
        if (!cancelled) setUnlocked(true);
        return;
      }
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        if (!cancelled) {
          setAvailable(false);
          setUnlocked(true);
        }
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Mở chaybo',
        fallbackLabel: 'Dùng mật mã',
        disableDeviceFallback: false,
      });
      if (!cancelled && result.success) setUnlocked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.biometricLock]);

  if (!settings.biometricLock || unlocked) return <>{children}</>;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <Ionicons name="lock-closed" size={48} color={colors.accent} />
      <Text style={[styles.title, { color: colors.text }]}>chaybo bị khoá</Text>
      <Text style={[styles.hint, { color: colors.textDim }]}>
        Dùng Face ID / Touch ID để mở app.
      </Text>
      {!available ? (
        <Text style={[styles.hint, { color: colors.danger }]}>
          Thiết bị chưa cài đặt sinh trắc học — tắt khoá trong Cài đặt.
        </Text>
      ) : null}
      <Pressable
        onPress={() => {
          void (async () => {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Mở chaybo',
              fallbackLabel: 'Dùng mật mã',
              disableDeviceFallback: false,
            });
            if (result.success) setUnlocked(true);
          })();
        }}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.buttonLabel, { color: colors.bg }]}>Mở khoá</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  hint: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  button: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#D8FF3E',
  },
  buttonLabel: { fontSize: 14, fontWeight: '700' },
});