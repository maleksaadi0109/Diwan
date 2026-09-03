import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { splitHemistichs } from '@/lib/utils';
import type { Poem } from '@/lib/types';

const MAX_VERSES_IN_CARD = 6;
const MIN_CARD_FONT_SIZE = 14;
const MAX_CARD_FONT_SIZE = 30;

interface CardTheme {
  id: string;
  label: string;
  background: string;
  foreground: string;
  accent: string;
  border: string;
}

const CARD_THEMES: CardTheme[] = [
  {
    id: 'ink',
    label: 'حبر',
    background: '#181311',
    foreground: '#F5EBDD',
    accent: '#C79A5E',
    border: '#5D4936',
  },
  {
    id: 'paper',
    label: 'ورق',
    background: '#F2E5CB',
    foreground: '#2B211B',
    accent: '#8B5E34',
    border: '#C8B28E',
  },
  {
    id: 'midnight',
    label: 'ليل',
    background: '#101827',
    foreground: '#F1E8D8',
    accent: '#D3A768',
    border: '#35445E',
  },
  {
    id: 'olive',
    label: 'زيتون',
    background: '#18201B',
    foreground: '#EFE8D9',
    accent: '#C6A15B',
    border: '#405043',
  },
];

function defaultCardFontSize(verseCount: number): number {
  if (verseCount <= 2) return 22;
  if (verseCount <= 4) return 18;
  return 15;
}

interface VerseShareModalProps {
  poem: Poem;
  initialVerseIndex: number;
  onClose: () => void;
}

export function VerseShareModal({
  poem,
  initialVerseIndex,
  onClose,
}: VerseShareModalProps) {
  const colors = useColors();
  const viewShotRef = useRef<React.ElementRef<typeof ViewShot>>(null);
  const [rangeStart, setRangeStart] = useState(initialVerseIndex);
  const [rangeEnd, setRangeEnd] = useState(initialVerseIndex);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });
  const [cardThemeId, setCardThemeId] = useState(CARD_THEMES[0].id);
  const cardTheme =
    CARD_THEMES.find((theme) => theme.id === cardThemeId) ?? CARD_THEMES[0];

  const verses = useMemo(
    () => poem.verses.slice(rangeStart, rangeEnd + 1),
    [poem.verses, rangeStart, rangeEnd],
  );
  const verseCount = rangeEnd - rangeStart + 1;
  const canExtendUp = rangeStart > 0 && verseCount < MAX_VERSES_IN_CARD;
  const canExtendDown =
    rangeEnd < poem.verses.length - 1 && verseCount < MAX_VERSES_IN_CARD;
  const canShrink = verseCount > 1;

  const [cardFontSize, setCardFontSize] = useState(() =>
    defaultCardFontSize(verseCount),
  );
  const lastAutoVerseCount = useRef(verseCount);
  if (lastAutoVerseCount.current !== verseCount) {
    lastAutoVerseCount.current = verseCount;
    const nextDefault = defaultCardFontSize(verseCount);
    if (cardFontSize !== nextDefault) setCardFontSize(nextDefault);
  }

  const handleShare = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      if (!viewShotRef.current?.capture) {
        throw new Error('Image capture is unavailable');
      }
      const uri = await viewShotRef.current.capture();
      if (Platform.OS === 'web') {
        const link = globalThis.document.createElement('a');
        link.href = uri;
        link.download = `${poem.title || 'ديوان'}-بطاقة.png`;
        link.click();
        return;
      }
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: poem.title,
        });
      } else {
        setExportError('المشاركة غير متاحة على هذا الجهاز.');
      }
    } catch (error) {
      console.error('Verse card export failed', error);
      setExportError('تعذّر إنشاء الصورة. حاول مرة أخرى.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              مشاركة كصورة
            </Text>
            <Pressable onPress={onClose} hitSlop={12} testID="verse-share-close">
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.rangeRow}>
            <Pressable
              onPress={() => setRangeStart((i) => Math.max(0, i - 1))}
              disabled={!canExtendUp}
              testID="verse-share-extend-up"
              style={[
                styles.rangeButton,
                { borderColor: colors.border, opacity: canExtendUp ? 1 : 0.35 },
              ]}
            >
              <Feather name="chevron-up" size={14} color={colors.mutedForeground} />
              <Text style={[styles.rangeButtonText, { color: colors.mutedForeground }]}>
                بيت سابق
              </Text>
            </Pressable>
            <Text style={[styles.rangeLabel, { color: colors.mutedForeground }]}>
              {verseCount === 1 ? 'بيت واحد' : `${verseCount} أبيات`}
            </Text>
            <Pressable
              onPress={() =>
                setRangeEnd((i) => Math.min(poem.verses.length - 1, i + 1))
              }
              disabled={!canExtendDown}
              testID="verse-share-extend-down"
              style={[
                styles.rangeButton,
                { borderColor: colors.border, opacity: canExtendDown ? 1 : 0.35 },
              ]}
            >
              <Text style={[styles.rangeButtonText, { color: colors.mutedForeground }]}>
                بيت تالٍ
              </Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.fontRow}>
            <Pressable
              onPress={() =>
                setCardFontSize((s) => Math.max(MIN_CARD_FONT_SIZE, s - 2))
              }
              hitSlop={10}
              testID="verse-share-font-decrease"
            >
              <Feather name="minus" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.fontLabel, { color: colors.mutedForeground }]}>
              حجم الخط
            </Text>
            <Pressable
              onPress={() =>
                setCardFontSize((s) => Math.min(MAX_CARD_FONT_SIZE, s + 2))
              }
              hitSlop={10}
              testID="verse-share-font-increase"
            >
              <Feather name="plus" size={16} color={colors.mutedForeground} />
            </Pressable>
            {canShrink ? (
              <Pressable
                onPress={() => {
                  setRangeStart(initialVerseIndex);
                  setRangeEnd(initialVerseIndex);
                }}
                testID="verse-share-reset"
              >
                <Text style={[styles.resetText, { color: colors.primary }]}>
                  إعادة ضبط
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.themeSection}>
            <Text style={[styles.themeLabel, { color: colors.mutedForeground }]}>
              خلفية البطاقة
            </Text>
            <View style={styles.themeRow}>
              {CARD_THEMES.map((theme) => {
                const selected = theme.id === cardTheme.id;
                return (
                  <Pressable
                    key={theme.id}
                    onPress={() => setCardThemeId(theme.id)}
                    style={styles.themeOption}
                    accessibilityLabel={`خلفية ${theme.label}`}
                    testID={`verse-share-theme-${theme.id}`}
                  >
                    <View
                      style={[
                        styles.themeSwatch,
                        {
                          backgroundColor: theme.background,
                          borderColor: selected ? colors.primary : colors.border,
                          borderWidth: selected ? 3 : 1,
                        },
                      ]}
                    >
                      {selected ? (
                        <Feather name="check" size={14} color={theme.accent} />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.themeOptionLabel,
                        { color: selected ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {theme.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView style={styles.previewScroll}>
            <ViewShot
              ref={viewShotRef}
              options={{
                format: 'png',
                quality: 1,
                result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile',
                ...(Platform.OS === 'web' && cardSize.width > 0 && cardSize.height > 0
                  ? {
                      width: Math.round(cardSize.width * 2),
                      height: Math.round(cardSize.height * 2),
                    }
                  : {}),
              }}
              onLayout={({ nativeEvent }) => {
                const { width, height } = nativeEvent.layout;
                setCardSize((current) =>
                  current.width === width && current.height === height
                    ? current
                    : { width, height },
                );
              }}
              style={[
                styles.cardPreview,
                {
                  backgroundColor: cardTheme.background,
                  borderColor: cardTheme.accent,
                },
              ]}
            >
              <View style={[styles.cardOrnament, { backgroundColor: cardTheme.accent }]} />
              <Text style={[styles.cardTitle, { color: cardTheme.foreground }]}>
                {poem.title}
              </Text>
              <Text style={[styles.cardPoet, { color: cardTheme.accent }]}>
                {poem.poetName}
              </Text>
              <View
                style={[styles.cardTitleDivider, { backgroundColor: cardTheme.border }]}
              />
              <View style={styles.cardVerses}>
                {verses.map((verse) => {
                  const { first, second } = splitHemistichs(verse.text);
                  return (
                    <View key={verse.id} style={styles.cardVersePair}>
                      <Text
                        style={[
                          styles.cardVerseText,
                          {
                            fontSize: cardFontSize,
                            lineHeight: cardFontSize * 1.7,
                            color: cardTheme.foreground,
                          },
                        ]}
                      >
                        {first}
                      </Text>
                      {second ? (
                        <>
                          <View style={styles.hemistichSeparator}>
                            <View
                              style={[
                                styles.hemistichLine,
                                { backgroundColor: cardTheme.border },
                              ]}
                            />
                            <View
                              style={[
                                styles.hemistichDot,
                                { backgroundColor: cardTheme.accent },
                              ]}
                            />
                            <View
                              style={[
                                styles.hemistichLine,
                                { backgroundColor: cardTheme.border },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.cardVerseText,
                              {
                                fontSize: cardFontSize,
                                lineHeight: cardFontSize * 1.7,
                                color: cardTheme.foreground,
                              },
                            ]}
                          >
                            {second}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <View style={styles.cardFooterRow}>
                <View
                  style={[styles.cardFooterLine, { backgroundColor: cardTheme.border }]}
                />
                <Text style={[styles.cardFooterLabel, { color: cardTheme.accent }]}>
                  ديوان
                </Text>
                <View
                  style={[styles.cardFooterLine, { backgroundColor: cardTheme.border }]}
                />
              </View>
            </ViewShot>
          </ScrollView>

          {exportError ? (
            <Text style={[styles.errorText, { color: '#e05252' }]}>{exportError}</Text>
          ) : null}

          <Pressable
            onPress={handleShare}
            disabled={isExporting}
            style={[styles.shareButton, { backgroundColor: colors.primary }]}
            testID="verse-share-confirm"
          >
            <Feather name="share-2" size={18} color={colors.primaryForeground} />
            <Text style={[styles.shareButtonText, { color: colors.primaryForeground }]}>
              {isExporting ? 'جارٍ التجهيز...' : 'مشاركة الصورة'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'web' ? 34 : 24,
    maxHeight: '90%',
    gap: 16,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Cairo_700Bold',
  },
  rangeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  rangeButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rangeButtonText: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
  },
  rangeLabel: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
  },
  fontRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  fontLabel: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
  },
  resetText: {
    marginRight: 'auto',
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
  },
  themeSection: {
    gap: 8,
  },
  themeLabel: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'right',
  },
  themeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeOption: {
    minWidth: 52,
    alignItems: 'center',
    gap: 5,
  },
  themeSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOptionLabel: {
    fontSize: 10,
    fontFamily: 'Cairo_600SemiBold',
  },
  previewScroll: {
    maxHeight: 400,
  },
  cardPreview: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  cardOrnament: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'center',
  },
  cardPoet: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    marginTop: 6,
    marginBottom: 18,
  },
  cardTitleDivider: {
    width: 80,
    height: 1,
    marginBottom: 24,
  },
  cardVerses: {
    gap: 24,
    width: '100%',
  },
  cardVersePair: {
    width: '100%',
    alignItems: 'center',
  },
  cardVerseText: {
    textAlign: 'center',
    fontFamily: 'Amiri_700Bold',
  },
  hemistichSeparator: {
    width: 70,
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  hemistichLine: {
    flex: 1,
    height: 1,
  },
  hemistichDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
  },
  cardFooterLine: {
    width: 24,
    height: 1,
    backgroundColor: '#3A332E',
  },
  cardFooterLabel: {
    fontSize: 10,
    fontFamily: 'Cairo_600SemiBold',
    letterSpacing: 2,
    color: '#A3968A',
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    height: 52,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
  },
});
