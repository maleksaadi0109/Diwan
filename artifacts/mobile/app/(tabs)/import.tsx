import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import {
  useGetYoutubeInfo,
  useDownloadYoutubeAudio,
  useAlignPoemVerses,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLibrary } from '@/contexts/LibraryContext';
import {
  extractErrorMessage,
  formatDuration,
  makeLocalId,
  needsCookieUnlock,
  toPlayableAudioUrl,
} from '@/lib/api';
import type { Poem, Verse } from '@/lib/types';
import {
  CatalogPoemEntry,
  POEM_CATALOG,
  extractMizanPoemId,
  fetchMizanPoem,
  parseMizanPoem,
  type ParsedMizanPoem,
} from '@/lib/mizan';

type Stage = 'link' | 'details' | 'downloading' | 'aligning';
type CatalogItemStatus = 'idle' | 'text' | 'downloading' | 'aligning' | 'error';

export default function ImportScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addPoem } = useLibrary();

  const [stage, setStage] = useState<Stage>('link');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [videoInfo, setVideoInfo] = useState<{
    title: string;
    channel: string;
    durationMs: number;
    thumbnail?: string;
  } | null>(null);

  const [title, setTitle] = useState('');
  const [poetName, setPoetName] = useState('');
  const [versesText, setVersesText] = useState('');

  const [needsCookies, setNeedsCookies] = useState(false);
  const [cookiesText, setCookiesText] = useState('');
  const [showCookieHelp, setShowCookieHelp] = useState(false);

  const { poems } = useLibrary();
  const [activeCatalogId, setActiveCatalogId] = useState<string | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<Record<string, CatalogItemStatus>>({});

  const [mizanUrl, setMizanUrl] = useState('');
  const [mizanLoading, setMizanLoading] = useState(false);
  const [mizanError, setMizanError] = useState<string | null>(null);
  const [mizanPreview, setMizanPreview] = useState<{
    poemId: string;
    parsed: ParsedMizanPoem;
  } | null>(null);
  const [mizanSaving, setMizanSaving] = useState(false);

  const importedMizanIds = new Set(
    poems.filter((p) => p.externalProvider === 'mizan_al_arab').map((p) => p.externalId),
  );

  const infoMutation = useGetYoutubeInfo();
  const downloadMutation = useDownloadYoutubeAudio();
  const alignMutation = useAlignPoemVerses();

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const reset = () => {
    setStage('link');
    setUrl('');
    setError(null);
    setVideoInfo(null);
    setTitle('');
    setPoetName('');
    setVersesText('');
  };

  const handleFetchInfo = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const info = await infoMutation.mutateAsync({
        data: {
          url: trimmed,
          cookies_content: needsCookies ? cookiesText.trim() : undefined,
        },
      });
      setVideoInfo({
        title: info.title,
        channel: info.channel ?? '',
        durationMs: info.duration_ms,
        thumbnail: info.thumbnail,
      });
      setTitle(info.title ?? '');
      setNeedsCookies(false);
      setStage('details');
    } catch (err) {
      if (needsCookieUnlock(err)) {
        setNeedsCookies(true);
      }
      setError(extractErrorMessage(err, 'تعذر جلب بيانات الفيديو، تحقق من الرابط'));
    }
  };

  const handleImport = async () => {
    const trimmedTitle = title.trim();
    const trimmedPoet = poetName.trim();
    const lines = versesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!trimmedTitle || !trimmedPoet || lines.length === 0) {
      setError('يرجى إدخال عنوان القصيدة واسم الشاعر وأبيات القصيدة');
      return;
    }

    setError(null);
    try {
      setStage('downloading');
      const download = await downloadMutation.mutateAsync({
        data: {
          url: url.trim(),
          cookies_content: needsCookies ? cookiesText.trim() : undefined,
        },
      });

      const verses: Verse[] = lines.map((text, index) => ({
        id: makeLocalId('verse'),
        orderIndex: index,
        text,
      }));

      setStage('aligning');
      const alignment = await alignMutation.mutateAsync({
        data: {
          audio_path: download.processing_audio_path,
          verses: verses.map((v) => ({ id: v.id, text: v.text })),
          poem_id: makeLocalId('poem'),
          recording_id: makeLocalId('rec'),
        },
      });

      const alignmentByVerseId = new Map(
        alignment.alignments.map((entry) => [entry.verse_id, entry]),
      );

      const alignedVerses: Verse[] = verses.map((verse) => {
        const entry = alignmentByVerseId.get(verse.id);
        if (!entry) return verse;
        return {
          ...verse,
          alignment: {
            startMs: entry.start_ms,
            endMs: entry.end_ms,
            confidence: entry.confidence,
          },
        };
      });

      const poem: Poem = {
        id: makeLocalId('poem'),
        title: trimmedTitle,
        poetName: trimmedPoet,
        verses: alignedVerses,
        recording: {
          id: makeLocalId('rec'),
          audioUrl: toPlayableAudioUrl(download.playback_audio_path),
          durationMs: download.duration_ms ?? videoInfo?.durationMs ?? 0,
        },
        createdAt: Date.now(),
        sourceUrl: url.trim(),
      };

      await addPoem(poem);
      const importedId = poem.id;
      reset();
      router.push({ pathname: '/poem/[id]', params: { id: importedId } });
    } catch (err) {
      setStage('details');
      if (needsCookieUnlock(err)) {
        setNeedsCookies(true);
      }
      setError(extractErrorMessage(err, 'حدث خطأ أثناء الاستيراد، حاول مرة أخرى'));
    }
  };

  const handleMizanFetch = async () => {
    const trimmed = mizanUrl.trim();
    if (!trimmed) return;
    setMizanError(null);
    setMizanPreview(null);
    setMizanLoading(true);
    try {
      const poemId = extractMizanPoemId(trimmed);
      const existing = poems.find(
        (p) => p.externalProvider === 'mizan_al_arab' && p.externalId === poemId,
      );
      if (existing) {
        router.push({ pathname: '/poem/[id]', params: { id: existing.id } });
        return;
      }
      const data = await fetchMizanPoem(poemId);
      const parsed = parseMizanPoem(data);
      setMizanPreview({ poemId, parsed });
    } catch (err) {
      setMizanError(extractErrorMessage(err, 'تعذر جلب القصيدة من ميزان العرب'));
    } finally {
      setMizanLoading(false);
    }
  };

  const handleMizanImport = async () => {
    if (!mizanPreview) return;
    setMizanSaving(true);
    setMizanError(null);
    try {
      const { poemId, parsed } = mizanPreview;
      const verses: Verse[] = parsed.verses.map((v, index) => ({
        id: makeLocalId('verse'),
        orderIndex: index,
        text: v.text,
      }));
      const poem: Poem = {
        id: makeLocalId('poem'),
        title: parsed.title,
        poetName: parsed.poetName,
        verses,
        createdAt: Date.now(),
        sourceUrl: mizanUrl.trim(),
        externalProvider: 'mizan_al_arab',
        externalId: poemId,
      };
      await addPoem(poem);
      const importedId = poem.id;
      setMizanUrl('');
      setMizanPreview(null);
      router.push({ pathname: '/poem/[id]', params: { id: importedId } });
    } catch (err) {
      setMizanError(extractErrorMessage(err, 'تعذر حفظ القصيدة، حاول مرة أخرى'));
    } finally {
      setMizanSaving(false);
    }
  };

  const handleCatalogImport = async (entry: CatalogPoemEntry) => {
    const existing = poems.find(
      (p) => p.externalProvider === 'mizan_al_arab' && p.externalId === entry.mizanPoemId,
    );
    if (existing) {
      router.push({ pathname: '/poem/[id]', params: { id: existing.id } });
      return;
    }

    setError(null);
    setActiveCatalogId(entry.id);
    setCatalogStatus((s) => ({ ...s, [entry.id]: 'text' }));
    try {
      const mizanData = await fetchMizanPoem(entry.mizanPoemId);
      const parsed = parseMizanPoem(mizanData);

      setCatalogStatus((s) => ({ ...s, [entry.id]: 'downloading' }));
      const download = await downloadMutation.mutateAsync({
        data: {
          url: entry.youtubeUrl,
          cookies_content: needsCookies ? cookiesText.trim() : undefined,
        },
      });

      const verses: Verse[] = parsed.verses.map((v, index) => ({
        id: makeLocalId('verse'),
        orderIndex: index,
        text: v.text,
      }));

      setCatalogStatus((s) => ({ ...s, [entry.id]: 'aligning' }));
      const alignment = await alignMutation.mutateAsync({
        data: {
          audio_path: download.processing_audio_path,
          verses: verses.map((v) => ({ id: v.id, text: v.text })),
          poem_id: makeLocalId('poem'),
          recording_id: makeLocalId('rec'),
        },
      });

      const alignmentByVerseId = new Map(
        alignment.alignments.map((entryAlign) => [entryAlign.verse_id, entryAlign]),
      );
      const alignedVerses: Verse[] = verses.map((verse) => {
        const alignEntry = alignmentByVerseId.get(verse.id);
        if (!alignEntry) return verse;
        return {
          ...verse,
          alignment: {
            startMs: alignEntry.start_ms,
            endMs: alignEntry.end_ms,
            confidence: alignEntry.confidence,
          },
        };
      });

      const poem: Poem = {
        id: makeLocalId('poem'),
        title: parsed.title,
        poetName: parsed.poetName !== 'شاعر غير معروف' ? parsed.poetName : entry.poetHint,
        verses: alignedVerses,
        recording: {
          id: makeLocalId('rec'),
          audioUrl: toPlayableAudioUrl(download.playback_audio_path),
          durationMs: download.duration_ms ?? 0,
        },
        createdAt: Date.now(),
        sourceUrl: entry.mizanUrl,
        externalProvider: 'mizan_al_arab',
        externalId: entry.mizanPoemId,
      };

      await addPoem(poem);
      const importedId = poem.id;
      setCatalogStatus((s) => ({ ...s, [entry.id]: 'idle' }));
      setActiveCatalogId(null);
      router.push({ pathname: '/poem/[id]', params: { id: importedId } });
    } catch (err) {
      if (needsCookieUnlock(err)) {
        setNeedsCookies(true);
      }
      setCatalogStatus((s) => ({ ...s, [entry.id]: 'error' }));
      setActiveCatalogId(null);
      setError(extractErrorMessage(err, 'تعذر استيراد القصيدة من ميزان العرب'));
    }
  };

  const isBusy = stage === 'downloading' || stage === 'aligning';
  const isCatalogBusy = activeCatalogId !== null;
  const anyBusy = isBusy || isCatalogBusy;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 12, paddingBottom: bottomInset + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          استيراد قصيدة
        </Text>

        {stage === 'link' ? (
          <View style={styles.catalogSection}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              مكتبة جاهزة
            </Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
              نصوص موثّقة من ميزان العرب مع تلاوات صوتية مطابقة — استيراد بضغطة واحدة
            </Text>
            <View style={styles.catalogList}>
              {POEM_CATALOG.map((entry) => {
                const imported = importedMizanIds.has(entry.mizanPoemId);
                const status: CatalogItemStatus | 'imported' = imported
                  ? 'imported'
                  : catalogStatus[entry.id] || 'idle';
                const isThisBusy = activeCatalogId === entry.id;
                const statusLabel =
                  status === 'text'
                    ? 'جلب النص...'
                    : status === 'downloading'
                      ? 'تنزيل الصوت...'
                      : status === 'aligning'
                        ? 'مزامنة الأبيات...'
                        : status === 'error'
                          ? 'إعادة المحاولة'
                          : status === 'imported'
                            ? 'مستوردة'
                            : null;
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => handleCatalogImport(entry)}
                    disabled={anyBusy && !isThisBusy}
                    testID={`catalog-item-${entry.id}`}
                    style={({ pressed }) => [
                      styles.catalogItem,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: anyBusy && !isThisBusy ? 0.4 : pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={styles.catalogItemText}>
                      <Text
                        style={[styles.catalogItemTitle, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {entry.titleHint}
                      </Text>
                      <Text
                        style={[styles.catalogItemPoet, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {entry.poetHint}
                      </Text>
                    </View>
                    {isThisBusy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : status === 'imported' ? (
                      <Feather name="check-circle" size={18} color={colors.primary} />
                    ) : status === 'error' ? (
                      <Feather name="refresh-cw" size={18} color={colors.destructive} />
                    ) : (
                      <Feather name="download" size={18} color={colors.mutedForeground} />
                    )}
                    {statusLabel && !isThisBusy ? (
                      <Text
                        style={[
                          styles.catalogItemStatus,
                          {
                            color:
                              status === 'error'
                                ? colors.destructive
                                : status === 'imported'
                                  ? colors.primary
                                  : colors.mutedForeground,
                          },
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
                أو استيراد نص فقط من رابط ميزان العرب
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <Text style={[styles.pageHint, { color: colors.mutedForeground }]}>
              الصق رابط أي قصيدة من mizanalarab.com لاستيراد نصها الموثّق (بدون صوت، يمكن
              إضافته لاحقًا)
            </Text>

            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={mizanUrl}
                onChangeText={(v) => {
                  setMizanUrl(v);
                  setMizanPreview(null);
                  setMizanError(null);
                }}
                placeholder="https://mizanalarab.com/poem/..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={[styles.textInput, { color: colors.foreground }]}
                editable={!mizanLoading && !mizanSaving}
                testID="mizan-url-input"
              />
              <Pressable
                onPress={handleMizanFetch}
                disabled={mizanLoading || mizanSaving || !mizanUrl.trim()}
                testID="mizan-fetch-button"
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: !mizanUrl.trim() || mizanLoading ? 0.4 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                {mizanLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="arrow-left" size={18} color={colors.primaryForeground} />
                )}
              </Pressable>
            </View>

            {mizanError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {mizanError}
              </Text>
            ) : null}

            {mizanPreview ? (
              <View
                style={[
                  styles.videoCard,
                  { backgroundColor: colors.card, borderColor: colors.border, padding: 12 },
                ]}
              >
                <View style={styles.videoInfoText}>
                  <Text
                    style={[styles.videoTitle, { color: colors.foreground, fontFamily: 'Amiri_700Bold' }]}
                    numberOfLines={2}
                  >
                    {mizanPreview.parsed.title}
                  </Text>
                  <Text style={[styles.videoMeta, { color: colors.mutedForeground }]}>
                    {mizanPreview.parsed.poetName} · {mizanPreview.parsed.verses.length} بيتًا
                  </Text>
                </View>
                <Pressable
                  onPress={handleMizanImport}
                  disabled={mizanSaving}
                  testID="mizan-import-confirm-button"
                  style={({ pressed }) => [
                    styles.iconButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: mizanSaving ? 0.6 : pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {mizanSaving ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="check" size={18} color={colors.primaryForeground} />
                  )}
                </Pressable>
              </View>
            ) : null}

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
                أو استيراد يدوي من رابط يوتيوب
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          </View>
        ) : null}

        <Text style={[styles.pageHint, { color: colors.mutedForeground }]}>
          الصق رابط تلاوة من يوتيوب، ثم أضف نص الأبيات لمزامنتها مع الصوت
        </Text>

        <View
          style={[
            styles.inputRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://youtube.com/watch?v=..."
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.textInput, { color: colors.foreground }]}
            editable={!anyBusy}
            testID="import-url-input"
          />
          <Pressable
            onPress={handleFetchInfo}
            disabled={infoMutation.isPending || !url.trim() || anyBusy}
            testID="import-fetch-info-button"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.primary,
                opacity: !url.trim() || anyBusy ? 0.4 : pressed ? 0.8 : 1,
              },
            ]}
          >
            {infoMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="arrow-left" size={18} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>

        {needsCookies ? (
          <View
            style={[
              styles.cookieCard,
              { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' },
            ]}
          >
            <View style={styles.cookieHeaderRow}>
              <Text style={styles.cookieTitle}>
                <Feather name="key" size={13} color="#fcd34d" /> هذا المقطع يتطلب تسجيل الدخول
              </Text>
              <Pressable onPress={() => setShowCookieHelp((v) => !v)} testID="import-cookie-help-toggle">
                <Text style={styles.cookieHelpLink}>كيف أحصل على الكوكيز؟</Text>
              </Pressable>
            </View>

            {showCookieHelp ? (
              <View style={styles.cookieHelpBox}>
                <Text style={styles.cookieHelpText}>
                  ١. سجّل الدخول إلى حسابك في YouTube داخل متصفحك.{'\n'}
                  ٢. استخدم إضافة متصفح مثل "Get cookies.txt LOCALLY" لتصدير كوكيز موقع
                  youtube.com بصيغة Netscape.{'\n'}
                  ٣. الصق محتوى الملف بالكامل في الحقل أدناه ثم أعد المحاولة.
                </Text>
              </View>
            ) : null}

            <TextInput
              value={cookiesText}
              onChangeText={setCookiesText}
              placeholder={'# Netscape HTTP Cookie File\n.youtube.com  TRUE  /  TRUE  ...'}
              placeholderTextColor="rgba(252, 211, 77, 0.4)"
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.cookieInput}
              testID="import-cookies-input"
            />
            <Text style={styles.cookieHint}>
              تُستخدم الكوكيز محليًا لهذه العملية فقط ولا يتم تخزينها.
            </Text>
            <Pressable
              onPress={handleFetchInfo}
              disabled={!cookiesText.trim() || infoMutation.isPending}
              testID="import-cookie-retry-button"
              style={({ pressed }) => [
                styles.cookieRetryButton,
                { opacity: !cookiesText.trim() ? 0.4 : pressed ? 0.8 : 1 },
              ]}
            >
              {infoMutation.isPending ? (
                <ActivityIndicator size="small" color="#fcd34d" />
              ) : (
                <Feather name="key" size={14} color="#fcd34d" />
              )}
              <Text style={styles.cookieRetryText}>إعادة المحاولة بتسجيل الدخول</Text>
            </Pressable>
          </View>
        ) : null}

        {videoInfo ? (
          <View
            style={[
              styles.videoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {videoInfo.thumbnail ? (
              <Image
                source={{ uri: videoInfo.thumbnail }}
                style={styles.thumbnail}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.videoInfoText}>
              <Text
                style={[styles.videoTitle, { color: colors.foreground }]}
                numberOfLines={2}
              >
                {videoInfo.title}
              </Text>
              <Text style={[styles.videoMeta, { color: colors.mutedForeground }]}>
                {videoInfo.channel} · {formatDuration(videoInfo.durationMs)}
              </Text>
            </View>
          </View>
        ) : null}

        {stage === 'details' || isBusy ? (
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                عنوان القصيدة
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={colors.mutedForeground}
                editable={!isBusy}
                style={[
                  styles.fieldInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                textAlign="right"
                testID="import-title-input"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                اسم الشاعر
              </Text>
              <TextInput
                value={poetName}
                onChangeText={setPoetName}
                placeholder="مثال: أحمد شوقي"
                placeholderTextColor={colors.mutedForeground}
                editable={!isBusy}
                style={[
                  styles.fieldInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                textAlign="right"
                testID="import-poet-input"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                أبيات القصيدة (كل بيت في سطر)
              </Text>
              <TextInput
                value={versesText}
                onChangeText={setVersesText}
                placeholder={'قفا نبك من ذكرى حبيب ومنزل\nبسقط اللوى بين الدخول فحومل'}
                placeholderTextColor={colors.mutedForeground}
                editable={!isBusy}
                multiline
                textAlignVertical="top"
                style={[
                  styles.textarea,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    fontFamily: 'Amiri_400Regular',
                  },
                ]}
                textAlign="right"
                testID="import-verses-input"
              />
            </View>

            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={handleImport}
              disabled={isBusy}
              testID="import-submit-button"
              style={({ pressed }) => [
                styles.submitButton,
                {
                  backgroundColor: colors.primary,
                  opacity: isBusy ? 0.7 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {isBusy ? (
                <>
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                  <Text
                    style={[styles.submitText, { color: colors.primaryForeground }]}
                  >
                    {stage === 'downloading'
                      ? 'جارٍ تنزيل الصوت...'
                      : 'جارٍ محاذاة الأبيات...'}
                  </Text>
                </>
              ) : (
                <>
                  <Feather name="download" size={16} color={colors.primaryForeground} />
                  <Text
                    style={[styles.submitText, { color: colors.primaryForeground }]}
                  >
                    استيراد القصيدة
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        ) : error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
  },
  pageHint: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
    marginTop: -8,
    lineHeight: 19,
  },
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCard: {
    flexDirection: 'row-reverse',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  thumbnail: {
    width: 100,
    height: 76,
  },
  videoInfoText: {
    flex: 1,
    padding: 12,
    gap: 4,
    justifyContent: 'center',
  },
  videoTitle: {
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
  },
  videoMeta: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'right',
  },
  fieldInput: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
  },
  textarea: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 140,
    lineHeight: 26,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  submitButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  submitText: {
    fontSize: 15,
    fontFamily: 'Cairo_700Bold',
  },
  cookieCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  cookieHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cookieTitle: {
    fontSize: 12,
    fontFamily: 'Cairo_700Bold',
    color: '#fcd34d',
    textAlign: 'right',
  },
  cookieHelpLink: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    color: 'rgba(252, 211, 77, 0.8)',
    textDecorationLine: 'underline',
  },
  cookieHelpBox: {
    backgroundColor: 'rgba(10, 11, 14, 0.5)',
    borderRadius: 10,
    padding: 10,
  },
  cookieHelpText: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    color: '#a0aab7',
    textAlign: 'right',
    lineHeight: 18,
  },
  cookieInput: {
    backgroundColor: 'rgba(10, 11, 14, 0.6)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
    color: '#fdfbf7',
    minHeight: 90,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
  },
  cookieHint: {
    fontSize: 10,
    fontFamily: 'Cairo_400Regular',
    color: 'rgba(160, 170, 183, 0.8)',
    textAlign: 'right',
  },
  cookieRetryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  cookieRetryText: {
    fontSize: 12,
    fontFamily: 'Cairo_700Bold',
    color: '#fcd34d',
  },
  catalogSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
  },
  sectionHint: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
    lineHeight: 16,
  },
  catalogList: {
    gap: 8,
  },
  catalogItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  catalogItemText: {
    flex: 1,
    gap: 2,
  },
  catalogItemTitle: {
    fontSize: 13,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
  },
  catalogItemPoet: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  catalogItemStatus: {
    fontSize: 10,
    fontFamily: 'Cairo_400Regular',
  },
  dividerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
  },
});
