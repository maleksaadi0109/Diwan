import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import {
  useDownloadYoutubeAudio,
  useAlignPoemVerses,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useLibrary } from '@/contexts/LibraryContext';
import {
  extractErrorMessage,
  makeLocalId,
  needsCookieUnlock,
  toPlayableAudioUrl,
  uploadAudioFile,
  type UploadedAudioJob,
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

type CatalogItemStatus = 'idle' | 'text' | 'downloading' | 'aligning' | 'error';
type MizanAudioMode = 'none' | 'youtube' | 'upload' | 'record';

interface PickedAudioFile {
  uri: string;
  name: string;
  mimeType: string;
  sizeLabel?: string;
}

const AUDIO_MODE_OPTIONS: {
  key: MizanAudioMode;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: 'none', label: 'نص فقط', icon: 'file-text' },
  { key: 'youtube', label: 'رابط يوتيوب', icon: 'youtube' },
  { key: 'upload', label: 'رفع ملف', icon: 'upload' },
  { key: 'record', label: 'تسجيل صوتي', icon: 'mic' },
];

function formatRecordingTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function ImportScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addPoem, poems } = useLibrary();

  const [error, setError] = useState<string | null>(null);

  const [needsCookies, setNeedsCookies] = useState(false);
  const [cookiesText, setCookiesText] = useState('');
  const [showCookieHelp, setShowCookieHelp] = useState(false);

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
  const [mizanImportStage, setMizanImportStage] = useState<
    'idle' | 'downloading' | 'aligning'
  >('idle');

  const [mizanAudioMode, setMizanAudioMode] = useState<MizanAudioMode>('none');
  const [mizanYoutubeUrl, setMizanYoutubeUrl] = useState('');
  const [mizanUploadedFile, setMizanUploadedFile] = useState<PickedAudioFile | null>(null);
  const [mizanRecordedUri, setMizanRecordedUri] = useState<string | null>(null);
  const [mizanRecordedDurationMs, setMizanRecordedDurationMs] = useState(0);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  const importedMizanIds = new Set(
    poems.filter((p) => p.externalProvider === 'mizan_al_arab').map((p) => p.externalId),
  );

  const downloadMutation = useDownloadYoutubeAudio();
  const alignMutation = useAlignPoemVerses();

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const resetMizanAudioState = () => {
    setMizanAudioMode('none');
    setMizanYoutubeUrl('');
    setMizanUploadedFile(null);
    setMizanRecordedUri(null);
    setMizanRecordedDurationMs(0);
  };

  const resetMizanForm = () => {
    setMizanUrl('');
    setMizanPreview(null);
    resetMizanAudioState();
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

  const handlePickAudioFile = async () => {
    setMizanError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setMizanUploadedFile({
        uri: asset.uri,
        name: asset.name || 'recitation.mp3',
        mimeType: asset.mimeType || 'audio/mpeg',
        sizeLabel:
          typeof asset.size === 'number' ? `${(asset.size / (1024 * 1024)).toFixed(1)} م.ب` : undefined,
      });
    } catch {
      setMizanError('تعذر اختيار الملف الصوتي');
    }
  };

  const handleStartRecording = async () => {
    setMizanError(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMizanError('يجب السماح باستخدام الميكروفون لتسجيل التلاوة');
        return;
      }
      setMizanRecordedUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setMizanError('تعذر بدء التسجيل، حاول مرة أخرى');
    }
  };

  const handleStopRecording = async () => {
    try {
      const durationMs = recorderState.durationMillis;
      await recorder.stop();
      if (recorder.uri) {
        setMizanRecordedUri(recorder.uri);
        setMizanRecordedDurationMs(Math.round(durationMs));
      }
    } catch {
      setMizanError('تعذر إيقاف التسجيل');
    }
  };

  const handleDiscardRecording = () => {
    setMizanRecordedUri(null);
    setMizanRecordedDurationMs(0);
  };

  const handleMizanImport = async () => {
    if (!mizanPreview) return;
    setMizanSaving(true);
    setMizanError(null);
    const { poemId, parsed } = mizanPreview;
    const verses: Verse[] = parsed.verses.map((v, index) => ({
      id: makeLocalId('verse'),
      orderIndex: index,
      text: v.text,
    }));

    // Text-only path: no audio source chosen, save immediately.
    if (mizanAudioMode === 'none') {
      try {
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
        resetMizanForm();
        router.push({ pathname: '/poem/[id]', params: { id: importedId } });
      } catch (err) {
        setMizanError(extractErrorMessage(err, 'تعذر حفظ القصيدة، حاول مرة أخرى'));
      } finally {
        setMizanSaving(false);
      }
      return;
    }

    // Audio path: obtain a processed audio job (from YouTube, an uploaded
    // file, or a fresh recording), then align it against the Mizan text
    // exactly like the fixed catalog entries.
    try {
      let job: UploadedAudioJob;

      if (mizanAudioMode === 'youtube') {
        const trimmedYoutubeUrl = mizanYoutubeUrl.trim();
        if (!trimmedYoutubeUrl) {
          setMizanError('يرجى إدخال رابط يوتيوب');
          setMizanSaving(false);
          return;
        }
        setMizanImportStage('downloading');
        job = await downloadMutation.mutateAsync({
          data: {
            url: trimmedYoutubeUrl,
            cookies_content: needsCookies ? cookiesText.trim() : undefined,
          },
        });
      } else if (mizanAudioMode === 'upload') {
        if (!mizanUploadedFile) {
          setMizanError('يرجى اختيار ملف صوتي');
          setMizanSaving(false);
          return;
        }
        setMizanImportStage('downloading');
        job = await uploadAudioFile({
          uri: mizanUploadedFile.uri,
          fileName: mizanUploadedFile.name,
          mimeType: mizanUploadedFile.mimeType,
        });
      } else {
        if (!mizanRecordedUri) {
          setMizanError('يرجى تسجيل مقطع صوتي أولاً');
          setMizanSaving(false);
          return;
        }
        setMizanImportStage('downloading');
        job = await uploadAudioFile({
          uri: mizanRecordedUri,
          fileName: 'recitation.m4a',
          mimeType: 'audio/m4a',
        });
      }

      setMizanImportStage('aligning');
      const alignment = await alignMutation.mutateAsync({
        data: {
          audio_path: job.processing_audio_path,
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
        title: parsed.title,
        poetName: parsed.poetName,
        verses: alignedVerses,
        recording: {
          id: makeLocalId('rec'),
          audioUrl: toPlayableAudioUrl(job.playback_audio_path),
          durationMs: job.duration_ms ?? mizanRecordedDurationMs ?? 0,
        },
        createdAt: Date.now(),
        sourceUrl: mizanUrl.trim(),
        externalProvider: 'mizan_al_arab',
        externalId: poemId,
      };

      await addPoem(poem);
      const importedId = poem.id;
      resetMizanForm();
      router.push({ pathname: '/poem/[id]', params: { id: importedId } });
    } catch (err) {
      if (needsCookieUnlock(err)) {
        setNeedsCookies(true);
      }
      setMizanError(extractErrorMessage(err, 'تعذر معالجة الصوت أو مزامنته، حاول مرة أخرى'));
    } finally {
      setMizanImportStage('idle');
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

  const isCatalogBusy = activeCatalogId !== null;
  const anyBusy = isCatalogBusy || mizanSaving;

  const confirmLabel = mizanSaving
    ? mizanImportStage === 'downloading'
      ? mizanAudioMode === 'youtube'
        ? 'جارٍ تنزيل الصوت...'
        : 'جارٍ معالجة الصوت...'
      : mizanImportStage === 'aligning'
        ? 'جارٍ مزامنة الأبيات...'
        : 'جارٍ الحفظ...'
    : mizanAudioMode === 'none'
      ? 'استيراد النص فقط'
      : 'استيراد مع الصوت';

  const confirmDisabled =
    mizanSaving ||
    (mizanAudioMode === 'youtube' && !mizanYoutubeUrl.trim()) ||
    (mizanAudioMode === 'upload' && !mizanUploadedFile) ||
    (mizanAudioMode === 'record' && !mizanRecordedUri);

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
              أو استيراد أي قصيدة من ميزان العرب
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Text style={[styles.pageHint, { color: colors.mutedForeground }]}>
            الصق رابط أي قصيدة من mizanalarab.com لاستيراد نصها الموثّق، ثم اختر
            كيف تريد إضافة الصوت
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
                resetMizanAudioState();
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

          {mizanUrl.trim() && !mizanPreview ? (
            <View
              style={[
                styles.sourcePromptCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sourcePromptTitle, { color: colors.foreground }]}>
                اختر مصدر الصوت
              </Text>
              <Text style={[styles.sourcePromptHint, { color: colors.mutedForeground }]}>
                سيظهر هذا الاختيار مع معاينة القصيدة أيضًا
              </Text>
              <View style={styles.audioModeRow}>
                {AUDIO_MODE_OPTIONS.map((option) => {
                  const selected = mizanAudioMode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setMizanAudioMode(option.key)}
                      disabled={mizanLoading || mizanSaving}
                      testID={`mizan-audio-mode-before-fetch-${option.key}`}
                      style={({ pressed }) => [
                        styles.audioModeChip,
                        {
                          backgroundColor: selected ? colors.primary : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                          opacity: mizanLoading || mizanSaving ? 0.6 : pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name={option.icon}
                        size={14}
                        color={selected ? colors.primaryForeground : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.audioModeChipText,
                          {
                            color: selected
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {mizanAudioMode === 'youtube' ? (
                <View
                  style={[
                    styles.inputRow,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    value={mizanYoutubeUrl}
                    onChangeText={setMizanYoutubeUrl}
                    placeholder="https://youtube.com/watch?v=..."
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={[styles.textInput, { color: colors.foreground }]}
                    editable={!mizanLoading && !mizanSaving}
                    testID="mizan-youtube-url-input-before-fetch"
                  />
                </View>
              ) : null}

              {mizanAudioMode === 'upload' ? (
                <View style={styles.audioSourceBox}>
                  <Pressable
                    onPress={handlePickAudioFile}
                    disabled={mizanLoading || mizanSaving}
                    testID="mizan-upload-pick-button-before-fetch"
                    style={({ pressed }) => [
                      styles.audioSourceButton,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        opacity: mizanLoading || mizanSaving ? 0.6 : pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather name="upload" size={16} color={colors.primary} />
                    <Text style={[styles.audioSourceButtonText, { color: colors.foreground }]}>
                      {mizanUploadedFile ? 'اختيار ملف آخر' : 'اختيار ملف صوتي'}
                    </Text>
                  </Pressable>
                  {mizanUploadedFile ? (
                    <View style={styles.audioSourceInfoRow}>
                      <Feather name="music" size={13} color={colors.mutedForeground} />
                      <Text
                        style={[styles.audioSourceInfoText, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {mizanUploadedFile.name}
                        {mizanUploadedFile.sizeLabel ? ` · ${mizanUploadedFile.sizeLabel}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {mizanAudioMode === 'record' ? (
                <View style={styles.audioSourceBox}>
                  {!recorderState.isRecording && !mizanRecordedUri ? (
                    <Pressable
                      onPress={handleStartRecording}
                      disabled={mizanLoading || mizanSaving}
                      testID="mizan-record-start-button-before-fetch"
                      style={({ pressed }) => [
                        styles.audioSourceButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          opacity: mizanLoading || mizanSaving ? 0.6 : pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather name="mic" size={16} color={colors.primary} />
                      <Text style={[styles.audioSourceButtonText, { color: colors.foreground }]}>
                        بدء التسجيل
                      </Text>
                    </Pressable>
                  ) : null}

                  {recorderState.isRecording ? (
                    <Pressable
                      onPress={handleStopRecording}
                      testID="mizan-record-stop-button-before-fetch"
                      style={({ pressed }) => [
                        styles.audioSourceButton,
                        {
                          borderColor: colors.destructive,
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather name="square" size={16} color={colors.destructive} />
                      <Text style={[styles.audioSourceButtonText, { color: colors.destructive }]}>
                        إيقاف التسجيل · {formatRecordingTime(recorderState.durationMillis)}
                      </Text>
                    </Pressable>
                  ) : null}

                  {!recorderState.isRecording && mizanRecordedUri ? (
                    <View style={styles.audioSourceInfoRow}>
                      <Feather name="check-circle" size={14} color={colors.primary} />
                      <Text style={[styles.audioSourceInfoText, { color: colors.mutedForeground }]}>
                        تم تسجيل {formatRecordingTime(mizanRecordedDurationMs)}
                      </Text>
                      <Pressable
                        onPress={handleDiscardRecording}
                        disabled={mizanLoading || mizanSaving}
                        testID="mizan-record-discard-button-before-fetch"
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Text style={[styles.sourcePromptHint, { color: colors.mutedForeground }]}>
                بعد اختيار المصدر اضغط زر السهم لجلب القصيدة والمتابعة
              </Text>
            </View>
          ) : null}

          {mizanError ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {mizanError}
            </Text>
          ) : null}

          {mizanPreview ? (
            <View
              style={[
                styles.mizanPreviewCard,
                { backgroundColor: colors.card, borderColor: colors.border },
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

              <Text style={[styles.mizanAudioLabel, { color: colors.mutedForeground }]}>
                هل تريد إضافة صوت لمزامنته مع الأبيات؟ (اختياري)
              </Text>

              <View style={styles.audioModeRow}>
                {AUDIO_MODE_OPTIONS.map((option) => {
                  const selected = mizanAudioMode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setMizanAudioMode(option.key)}
                      disabled={mizanSaving}
                      testID={`mizan-audio-mode-${option.key}`}
                      style={({ pressed }) => [
                        styles.audioModeChip,
                        {
                          backgroundColor: selected ? colors.primary : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                          opacity: mizanSaving ? 0.6 : pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather
                        name={option.icon}
                        size={14}
                        color={selected ? colors.primaryForeground : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.audioModeChipText,
                          { color: selected ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {mizanAudioMode === 'youtube' ? (
                <View
                  style={[
                    styles.inputRow,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    value={mizanYoutubeUrl}
                    onChangeText={setMizanYoutubeUrl}
                    placeholder="https://youtube.com/watch?v=..."
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    style={[styles.textInput, { color: colors.foreground }]}
                    editable={!mizanSaving}
                    testID="mizan-youtube-url-input"
                  />
                </View>
              ) : null}

              {mizanAudioMode === 'upload' ? (
                <View style={styles.audioSourceBox}>
                  <Pressable
                    onPress={handlePickAudioFile}
                    disabled={mizanSaving}
                    testID="mizan-upload-pick-button"
                    style={({ pressed }) => [
                      styles.audioSourceButton,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        opacity: mizanSaving ? 0.6 : pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Feather name="upload" size={16} color={colors.primary} />
                    <Text style={[styles.audioSourceButtonText, { color: colors.foreground }]}>
                      {mizanUploadedFile ? 'اختيار ملف آخر' : 'اختيار ملف صوتي'}
                    </Text>
                  </Pressable>
                  {mizanUploadedFile ? (
                    <View style={styles.audioSourceInfoRow}>
                      <Feather name="music" size={13} color={colors.mutedForeground} />
                      <Text
                        style={[styles.audioSourceInfoText, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {mizanUploadedFile.name}
                        {mizanUploadedFile.sizeLabel ? ` · ${mizanUploadedFile.sizeLabel}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {mizanAudioMode === 'record' ? (
                <View style={styles.audioSourceBox}>
                  {!recorderState.isRecording && !mizanRecordedUri ? (
                    <Pressable
                      onPress={handleStartRecording}
                      disabled={mizanSaving}
                      testID="mizan-record-start-button"
                      style={({ pressed }) => [
                        styles.audioSourceButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                          opacity: mizanSaving ? 0.6 : pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather name="mic" size={16} color={colors.primary} />
                      <Text style={[styles.audioSourceButtonText, { color: colors.foreground }]}>
                        بدء التسجيل
                      </Text>
                    </Pressable>
                  ) : null}

                  {recorderState.isRecording ? (
                    <Pressable
                      onPress={handleStopRecording}
                      testID="mizan-record-stop-button"
                      style={({ pressed }) => [
                        styles.audioSourceButton,
                        {
                          borderColor: colors.destructive,
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather name="square" size={16} color={colors.destructive} />
                      <Text style={[styles.audioSourceButtonText, { color: colors.destructive }]}>
                        إيقاف التسجيل · {formatRecordingTime(recorderState.durationMillis)}
                      </Text>
                    </Pressable>
                  ) : null}

                  {!recorderState.isRecording && mizanRecordedUri ? (
                    <View style={styles.audioSourceInfoRow}>
                      <Feather name="check-circle" size={14} color={colors.primary} />
                      <Text style={[styles.audioSourceInfoText, { color: colors.mutedForeground }]}>
                        تم تسجيل {formatRecordingTime(mizanRecordedDurationMs)}
                      </Text>
                      <Pressable
                        onPress={handleDiscardRecording}
                        disabled={mizanSaving}
                        testID="mizan-record-discard-button"
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {needsCookies && mizanAudioMode === 'youtube' ? (
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
                    onPress={handleMizanImport}
                    disabled={!cookiesText.trim() || mizanSaving}
                    testID="import-cookie-retry-button"
                    style={({ pressed }) => [
                      styles.cookieRetryButton,
                      { opacity: !cookiesText.trim() ? 0.4 : pressed ? 0.8 : 1 },
                    ]}
                  >
                    {mizanSaving ? (
                      <ActivityIndicator size="small" color="#fcd34d" />
                    ) : (
                      <Feather name="key" size={14} color="#fcd34d" />
                    )}
                    <Text style={styles.cookieRetryText}>إعادة المحاولة بتسجيل الدخول</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                onPress={handleMizanImport}
                disabled={confirmDisabled}
                testID="mizan-import-confirm-button"
                style={({ pressed }) => [
                  styles.submitButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: confirmDisabled ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {mizanSaving ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                    <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                      {confirmLabel}
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="check" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                      {confirmLabel}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>

        {error ? (
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
  videoInfoText: {
    flex: 1,
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
  mizanPreviewCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  mizanAudioLabel: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  sourcePromptCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
  },
  sourcePromptTitle: {
    fontSize: 13,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
  },
  sourcePromptHint: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  audioModeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  audioModeChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  audioModeChipText: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
  },
  audioSourceBox: {
    gap: 8,
  },
  audioSourceButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  audioSourceButtonText: {
    fontSize: 13,
    fontFamily: 'Cairo_700Bold',
  },
  audioSourceInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  audioSourceInfoText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
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
