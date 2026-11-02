import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, IconButton } from '@/components/ui';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles } from '@/hooks/useTheme';

const STRETCHES = [
  { name: 'Căng đùi trước', desc: 'Đứng, kéo gót chân về phía mông, giữ 30 giây mỗi bên.' },
  { name: 'Căng đùi sau', desc: 'Duỗi chân trước, cúi người về phía trước, giữ 30 giây.' },
  { name: 'Căng bắp chân', desc: 'Chống tường, một chân ra sau, giữ gót chân chạm đất 30 giây.' },
  { name: 'Căng hông', desc: 'Tư thế chiến binh thấp, xoay hông về trước, giữ 30 giây mỗi bên.' },
  { name: 'Căng lưng dưới', desc: 'Nằm ngửa, kéo gối vào ngực, giữ 30 giây.' },
  { name: 'Căng vai & cổ', desc: 'Nghiêng đầu về một bên, giữ 20 giây, đổi bên.' },
];

export default function StretchScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Quay lại" />
        <Text style={styles.headerTitle}>Giãn cơ sau chạy</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Eyebrow>6 động tác · 3 phút</Eyebrow>
        <Text style={styles.subtitle}>Thực hiện chậm rãi, thở đều, không đau.</Text>
        {STRETCHES.map((stretch, index) => (
          <View key={stretch.name} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{index + 1}</Text>
              </View>
              <Text style={styles.cardTitle}>{stretch.name}</Text>
            </View>
            <Text style={styles.cardBody}>{stretch.desc}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
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
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  subtitle: { fontSize: 12, color: c.textFaint, marginBottom: 4 },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 14,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { fontSize: 12, fontWeight: '700', color: c.accent },
  cardTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  cardBody: { fontSize: 12, lineHeight: 18, color: c.textDim },
});