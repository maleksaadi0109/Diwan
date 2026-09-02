import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import type { Verse } from '@/lib/types';

export default function PoemPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPoem, removePoem, updatePoem } = useLibrary();
  const { fontSize } = useSettings();
  const [editingVerseId, setEditingVerseId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [past, setPast] = useState<Verse[][]>([]);
  const [future, setFuture] = useState<Verse[][]>([]);

  const poem = getPoem(id);

  // Applies a verse-array mutation while recording an undo entry. Undo/redo
  // history here is scoped to this poem screen only (mirrors desktop's
  // per-poem undo scope, but as local component state instead of a global
  // context, since only verse edits/deletes/boundary marks happen here).
  const applyVerseChange = async (nextVerses: Verse[]) => {
    if (!poem) return;
    setPast((prev) => [...prev, poem.verses]);
    setFuture([]);
    await updatePoem(poem.id, (p) => ({ ...p, verses: nextVerses }));
  };

  const undo = async () => {
    if (!poem || past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [poem.verses, ...prev]);
    await updatePoem(poem.id, (p) => ({ ...p, verses: previous }));
  };

  const redo = async () => {
    if (!poem || future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, poem.verses]);
    await updatePoem(poem.id, (p) => ({ ...p, verses: next }));
  };

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

  const startEditVerse = (verse: Verse) => {
    setEditingVerseId(verse.id);
    setEditingText(verse.text);
  };

  const cancelEditVerse = () => {
    setEditingVerseId(null);
    setEditingText('');
  };

  const saveEditVerse = async () => {
    const trimmed = editingText.trim();
    if (!editingVerseId || !trimmed) {
      cancelEditVerse();
      return;
    }
    await applyVerseChange(
      poem.verses.map((v) =>
        v.id === editingVerseId ? { ...v, text: trimmed } : v,
      ),
    );
    cancelEditVerse();
  };

  const handleDeleteVerse = (verse: Verse) => {
    Alert.alert('حذف البيت', 'هل تريد حذف هذا البيت من القصيدة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await applyVerseChange(
            poem.verses
              .filter((v) => v.id !== verse.id)
              .map((v, index) => ({ ...v, orderIndex: index })),
          );
        },
      },
    ]);
  };

  // Touch equivalent of desktop's "press B during playback" boundary edit:
  // marks the split point between the active verse and the next one at the
  // current playback position.
  const markBoundaryHere = async () => {
    if (!activeVerseId) return;
    const activeIndex = poem.verses.findIndex((v) => v.id === activeVerseId);
    const nextVerse = poem.verses[activeIndex + 1];
    if (activeIndex === -1 || !nextVerse?.alignment) return;
    const activeVerse = poem.verses[activeIndex];
    if (!activeVerse.alignment) return;
    const boundaryMs = Math.round(currentMs);
    await applyVerseChange(
      poem.verses.map((v, index) => {
        if (index === activeIndex) {
          return { ...v, alignment: { ...v.alignment!, endMs: boundaryMs } };
        }
        if (index === activeIndex + 1) {
          return { ...v, alignment: { ...v.alignment!, startMs: boundaryMs } };
        }
        return v;
      }),
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="player-back-button">
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.topBarActions}>
          <Pressable
            onPress={undo}
            disabled={past.length === 0}
            hitSlop={12}
            testID="player-undo-button"
          >
            <Feather
              name="rotate-ccw"
              size={19}
              color={past.length === 0 ? colors.border : colors.mutedForeground}
            />
          </Pressable>
          <Pressable
            onPress={redo}
            disabled={future.length === 0}
            hitSlop={12}
            testID="player-redo-button"
          >
            <Feather
              name="rotate-cw"
              size={19}
              color={future.length === 0 ? colors.border : colors.mutedForeground}
            />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} testID="player-delete-button">
            <Feather name="trash-2" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
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
          const isEditing = verse.id === editingVerseId;

          if (isEditing) {
            return (
              <View
                key={verse.id}
                style={[styles.verseEditRow, { borderColor: colors.border }]}
              >
                <TextInput
                  value={editingText}
                  onChangeText={setEditingText}
                  multiline
                  autoFocus
                  textAlign="right"
                  style={[
                    styles.verseEditInput,
                    {
                      fontSize,
                      color: colors.foreground,
                      fontFamily: 'Amiri_400Regular',
                    },
                  ]}
                  testID={`verse-edit-input-${verse.id}`}
                />
                <View style={styles.verseEditActions}>
                  <Pressable
                    onPress={cancelEditVerse}
                    hitSlop={10}
                    testID={`verse-edit-cancel-${verse.id}`}
                  >
                    <Text style={[styles.verseEditAction, { color: colors.mutedForeground }]}>
                      إلغاء
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={saveEditVerse}
                    hitSlop={10}
                    testID={`verse-edit-save-${verse.id}`}
                  >
                    <Text style={[styles.verseEditAction, { color: colors.primary }]}>
                      حفظ
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }

          return (
            <Pressable
              key={verse.id}
              onPress={() =>
                verse.alignment ? seekToVerse(verse.alignment.startMs) : undefined
              }
              onLongPress={() => startEditVerse(verse)}
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
              <View style={styles.verseActionsRow}>
                <Pressable
                  onPress={() => startEditVerse(verse)}
                  hitSlop={10}
                  testID={`verse-edit-button-${verse.id}`}
                >
                  <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                </Pressable>
                <Pressable
                  onPress={() => handleDeleteVerse(verse)}
                  hitSlop={10}
                  testID={`verse-delete-button-${verse.id}`}
                >
                  <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
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
          {activeVerseId ? (
            <Pressable
              onPress={markBoundaryHere}
              hitSlop={8}
              style={styles.boundaryButton}
              testID="player-mark-boundary"
            >
              <Feather name="scissors" size={13} color={colors.mutedForeground} />
              <Text style={[styles.boundaryButtonText, { color: colors.mutedForeground }]}>
                ضبط حد البيت هنا
              </Text>
            </Pressable>
          ) : null}
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
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  boundaryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  boundaryButtonText: {
    fontSize: 12,
    fontFamily: 'Cairo_400Regular',
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
  verseActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 16,
    marginTop: 6,
  },
  verseEditRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  verseEditInput: {
    textAlignVertical: 'top',
    minHeight: 60,
  },
  verseEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 20,
  },
  verseEditAction: {
    fontSize: 13,
    fontFamily: 'Cairo_700Bold',
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
