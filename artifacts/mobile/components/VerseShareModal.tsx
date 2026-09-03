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
import type { Poem } from '@/lib/types';

const MAX_VERSES_IN_CARD = 6;
const MIN_CARD_FONT_SIZE = 14;
const MAX_CARD_FONT_SIZE = 30;

function defaultCardFontSize(verseCount: number): number {
  if (verseCount <= 2) return 22;
  if (verseCount <= 4) return 18;
  return 15;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapArabicText(value: string, maxCharacters: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maxCharacters) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

async function downloadWebVerseCard(
  poem: Poem,
  verses: Poem['verses'],
  fontSize: number,
  colors: { background: string; foreground: string; primary: string; border: string },
) {
  const browserWindow = globalThis.window;
  const document = globalThis.document;
  if (!browserWindow || !document) {
    throw new Error('Web image export is unavailable');
  }

  const verseLines = verses.flatMap((verse) => wrapArabicText(verse.text, 42));
  const lineHeight = Math.max(32, fontSize * 1.7);
  const height = Math.max(520, 250 + verseLines.length * lineHeight);
  const verseMarkup = verseLines
    .map(
      (line, index) =>
        `<text x="450" y="${225 + index * lineHeight}" text-anchor="middle" direction="rtl">${escapeXml(line)}</text>`,
    )
    .join('');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="${height}" viewBox="0 0 900 ${height}">
      <rect width="900" height="${height}" fill="${escapeXml(colors.background)}"/>
      <rect x="24" y="24" width="852" height="${height - 48}" rx="12" fill="none" stroke="${escapeXml(colors.primary)}" stroke-width="4"/>
      <text x="450" y="100" text-anchor="middle" direction="rtl" fill="${escapeXml(colors.foreground)}" font-family="Amiri, serif" font-size="34" font-weight="700">${escapeXml(poem.title)}</text>
      <text x="450" y="145" text-anchor="middle" direction="rtl" fill="${escapeXml(colors.primary)}" font-family="Cairo, sans-serif" font-size="20">${escapeXml(poem.poetName)}</text>
      <line x1="150" y1="175" x2="750" y2="175" stroke="${escapeXml(colors.border)}" stroke-width="2"/>
      <g fill="${escapeXml(colors.foreground)}" font-family="Amiri, serif" font-size="${fontSize * 1.7}">${verseMarkup}</g>
      <line x1="150" y1="${height - 72}" x2="750" y2="${height - 72}" stroke="${escapeXml(colors.border)}" stroke-width="2"/>
      <text x="450" y="${height - 38}" text-anchor="middle" fill="${escapeXml(colors.primary)}" font-family="Cairo, sans-serif" font-size="16">ديوان</text>
    </svg>
  `.trim();

  const svgUrl = browserWindow.URL.createObjectURL(
    new browserWindow.Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
  );

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new browserWindow.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to render verse card'));
      element.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1800;
    canvas.height = Math.round(height * 2);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `${poem.title || 'ديوان'}-بطاقة.png`;
    link.click();
  } finally {
    browserWindow.URL.revokeObjectURL(svgUrl);
  }
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
      if (Platform.OS === 'web') {
        await downloadWebVerseCard(poem, verses, cardFontSize, colors);
        return;
      }
      if (!viewShotRef.current?.capture) {
        throw new Error('Image capture is unavailable');
      }
      const uri = await viewShotRef.current.capture();
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

          <ScrollView style={styles.previewScroll}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 1 }}
              style={[styles.cardPreview, { backgroundColor: colors.background, borderColor: colors.primary }]}
            >
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                {poem.title}
              </Text>
              <Text style={[styles.cardPoet, { color: colors.primary }]}>
                {poem.poetName}
              </Text>
              <View style={styles.cardVerses}>
                {verses.map((verse) => (
                  <Text
                    key={verse.id}
                    style={[
                      styles.cardVerseText,
                      {
                        fontSize: cardFontSize,
                        lineHeight: cardFontSize * 1.7,
                        color: colors.foreground,
                      },
                    ]}
                  >
                    {verse.text}
                  </Text>
                ))}
              </View>
              <View style={styles.cardFooterRow}>
                <View style={[styles.cardFooterLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.cardFooterLabel, { color: colors.mutedForeground }]}>
                  ديوان
                </Text>
                <View style={[styles.cardFooterLine, { backgroundColor: colors.border }]} />
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
  cardTitle: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'center',
  },
  cardPoet: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    marginTop: 6,
    marginBottom: 24,
  },
  cardVerses: {
    gap: 16,
    width: '100%',
  },
  cardVerseText: {
    textAlign: 'center',
    fontFamily: 'Amiri_700Bold',
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
