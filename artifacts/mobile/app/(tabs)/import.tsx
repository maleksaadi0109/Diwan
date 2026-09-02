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
  toPlayableAudioUrl,
} from '@/lib/api';
import type { Poem, Verse } from '@/lib/types';

type Stage = 'link' | 'details' | 'downloading' | 'aligning';

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
      const info = await infoMutation.mutateAsync({ data: { url: trimmed } });
      setVideoInfo({
        title: info.title,
        channel: info.channel ?? '',
        durationMs: info.duration_ms,
        thumbnail: info.thumbnail,
      });
      setTitle(info.title ?? '');
      setStage('details');
    } catch (err) {
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
        data: { url: url.trim() },
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
      setError(extractErrorMessage(err, 'حدث خطأ أثناء الاستيراد، حاول مرة أخرى'));
    }
  };

  const isBusy = stage === 'downloading' || stage === 'aligning';

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
            testID="import-url-input"
          />
          <Pressable
            onPress={handleFetchInfo}
            disabled={infoMutation.isPending || !url.trim()}
            testID="import-fetch-info-button"
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.primary,
                opacity: !url.trim() ? 0.4 : pressed ? 0.8 : 1,
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
});
