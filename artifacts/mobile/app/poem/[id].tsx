import React, { useMemo } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useColors } from '@/hooks/useColors';
import { useLibrary } from '@/contexts/LibraryContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ProgressBar } from '@/components/ProgressBar';
import { formatDuration } from '@/lib/api';

export default function PoemPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPoem, removePoem } = useLibrary();
  const { fontSize } = useSettings();

  const poem = getPoem(id);

  const player = useAudioPlayer(poem?.recording?.audioUrl ?? null);
  const status = useAudioPlayerStatus(player);

  const currentMs = (status.currentTime ?? 0) * 1000;
  const durationMs =
    poem?.recording?.durationMs || (status.duration ?? 0) * 1000;
  const progress = durationMs > 0 ? currentMs / durationMs : 0;

  const activeVerseId = useMemo(() => {
    if (!poem) return null;
    const active = poem.verses.find(
      (v) =>
        v.alignment &&
        currentMs >= v.alignment.startMs &&
        currentMs < v.alignment.endMs,
    );
    return active?.id ?? null;
  }, [poem, currentMs]);

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  if (!poem) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-right" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.centerFill}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_400Regular' }}>
            القصيدة غير موجودة
          </Text>
        </View>
      </View>
    );
  }

  const togglePlay = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const seekBy = (deltaSeconds: number) => {
    const next = Math.max(0, (status.currentTime ?? 0) + deltaSeconds);
    player.seekTo(next);
  };

  const seekToRatio = (ratio: number) => {
    if (!durationMs) return;
    player.seekTo((ratio * durationMs) / 1000);
  };

  const seekToVerse = (startMs: number) => {
    player.seekTo(startMs / 1000);
    if (!status.playing) player.play();
  };

  const handleDelete = () => {
    Alert.alert('حذف القصيدة', `هل تريد حذف "${poem.title}" من مكتبتك؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await removePoem(poem.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="player-back-button">
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={handleDelete} hitSlop={12} testID="player-delete-button">
          <Feather name="trash-2" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.headerText}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {poem.title}
        </Text>
        <Text style={[styles.poet, { color: colors.mutedForeground }]}>
          {poem.poetName}
        </Text>
      </View>

      <ScrollView
        style={styles.versesScroll}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {poem.verses.map((verse) => {
          const isActive = verse.id === activeVerseId;
          return (
            <Pressable
              key={verse.id}
              onPress={() =>
                verse.alignment ? seekToVerse(verse.alignment.startMs) : undefined
              }
              disabled={!verse.alignment}
              style={[
                styles.verseRow,
                isActive && { backgroundColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.verseText,
                  {
                    fontSize,
                    color: isActive ? colors.accentForeground : colors.foreground,
                    lineHeight: fontSize * 1.7,
                  },
                ]}
              >
                {verse.text}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {poem.recording ? (
        <View
          style={[
            styles.playerBar,
            { paddingBottom: bottomInset + 16, borderTopColor: colors.border },
          ]}
        >
          <ProgressBar progress={progress} onSeek={seekToRatio} />
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
              {formatDuration(currentMs)}
            </Text>
            <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
              {formatDuration(durationMs)}
            </Text>
          </View>
          <View style={styles.controlsRow}>
            <Pressable onPress={() => seekBy(-10)} hitSlop={12} testID="player-back-10">
              <Feather name="rotate-ccw" size={22} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={togglePlay}
              testID="player-play-pause"
              style={[styles.playButton, { backgroundColor: colors.primary }]}
            >
              <Feather
                name={status.playing ? 'pause' : 'play'}
                size={26}
                color={colors.primaryForeground}
              />
            </Pressable>
            <Pressable onPress={() => seekBy(10)} hitSlop={12} testID="player-forward-10">
              <Feather name="rotate-cw" size={22} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerText: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 2,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
  },
  poet: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  versesScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  verseRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  verseText: {
    fontFamily: 'Amiri_400Regular',
    textAlign: 'right',
  },
  playerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  timeRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
