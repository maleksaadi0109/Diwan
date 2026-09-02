import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettings,
} from '@/contexts/SettingsContext';

const FONT_STEP = 2;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { fontSize, setFontSize } = useSettings();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const adjust = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFontSize(fontSize + delta);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 12, paddingBottom: bottomInset + 24 },
      ]}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>
        الإعدادات
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.foreground }]}>
          حجم خط القصيدة
        </Text>
        <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
          يتحكم بحجم نص الأبيات في شاشة القراءة
        </Text>

        <View style={styles.fontRow}>
          <Pressable
            onPress={() => adjust(FONT_STEP)}
            disabled={fontSize >= MAX_FONT_SIZE}
            testID="settings-font-increase"
            style={({ pressed }) => [
              styles.stepButton,
              {
                backgroundColor: colors.secondary,
                opacity: fontSize >= MAX_FONT_SIZE ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="plus" size={18} color={colors.foreground} />
          </Pressable>

          <View style={styles.fontPreviewWrap}>
            <Text
              style={[
                styles.fontPreview,
                { color: colors.foreground, fontSize },
              ]}
              numberOfLines={1}
            >
              أبجد هوز
            </Text>
          </View>

          <Pressable
            onPress={() => adjust(-FONT_STEP)}
            disabled={fontSize <= MIN_FONT_SIZE}
            testID="settings-font-decrease"
            style={({ pressed }) => [
              styles.stepButton,
              {
                backgroundColor: colors.secondary,
                opacity: fontSize <= MIN_FONT_SIZE ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="minus" size={18} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.aboutRow}>
          <Feather name="server" size={18} color={colors.primary} />
          <Text style={[styles.cardLabel, { color: colors.foreground }]}>
            استيراد الصوت
          </Text>
        </View>
        <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
          يعتمد استيراد قصائد يوتيوب على خادم واحد مشترك (تفريغ ومحاذاة صوتية
          محلية بدون أي خدمة ذكاء اصطناعي مدفوعة). يلزم اتصال بالإنترنت أثناء
          الاستيراد والاستماع فقط.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
    marginBottom: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  cardLabel: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
  },
  cardHint: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
    lineHeight: 19,
  },
  fontRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontPreviewWrap: {
    flex: 1,
    alignItems: 'center',
  },
  fontPreview: {
    fontFamily: 'Amiri_700Bold',
  },
  aboutRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
});
