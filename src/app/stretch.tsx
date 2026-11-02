import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, IconButton } from '@/components/ui';
import { colors, radius } from '@/lib/theme';

const STRETCHES = [
  { name: 'Căng đùi trước', desc: 'Đứng, kéo gót chân về phía mông, giữ 30 giây mỗi bên.' },
  { name: 'Căng đùi sau', desc: 'Duỗi chân trước, cúi người về phía trước, giữ 30 giây.' },
  { name: 'Căng bắp chân', desc: 'Chống tường, một chân ra sau, giữ gót chân chạm đất 30 giây.' },
  { name: 'Căng hông', desc: 'Tư thế chiến binh thấp, xoay hông về trước, giữ 30 giây mỗi bên.' },
  { name: 'Căng lưng dưới', desc: 'Nằm ngửa, kéo gối vào ngực, giữ 30 giây.' },
  { name: 'Căng vai & cổ', desc: 'Nghiêng đầu về một bên, giữ 20 giây, đổi bên.' },
];

export default function StretchScreen() {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
    color: colors.text,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  subtitle: { fontSize: 12, color: colors.textFaint, marginBottom: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 12, lineHeight: 18, color: colors.textDim },
});