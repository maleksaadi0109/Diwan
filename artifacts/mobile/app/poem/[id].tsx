import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
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
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useColors } from '@/hooks/useColors';
import { useLibrary } from '@/contexts/LibraryContext';
import { usePlaylists } from '@/contexts/PlaylistsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { ProgressBar } from '@/components/ProgressBar';
import { VerseShareModal } from '@/components/VerseShareModal';
import { formatDuration } from '@/lib/api';
import { splitHemistichs } from '@/lib/utils';
import type { Verse } from '@/lib/types';

export default function PoemPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPoem, removePoem, updatePoem } = useLibrary();
  const { playlists, createPlaylist, addPoemToPlaylist, removePoemFromPlaylist } =
    usePlaylists();
  const { fontSize, setFontSize } = useSettings();
  const [focusModeVisible, setFocusModeVisible] = useState(false);
  const focusScrollRef = React.useRef<ScrollView>(null);
  const focusVerseOffsets = React.useRef<Record<string, number>>({});
  const [editingVerseId, setEditingVerseId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [past, setPast] = useState<Verse[][]>([]);
  const [future, setFuture] = useState<Verse[][]>([]);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [shareVerseIndex, setShareVerseIndex] = useState<number | null>(null);

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

  React.useEffect(() => {
    if (!focusModeVisible || !activeVerseId) return;
    const offset = focusVerseOffsets.current[activeVerseId];
    if (offset != null) {
      focusScrollRef.current?.scrollTo({ y: Math.max(0, offset - 160), animated: true });
    }
  }, [activeVerseId, focusModeVisible]);

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
          <Pressable
            onPress={() => setPlaylistModalVisible(true)}
            hitSlop={12}
            testID="player-add-to-playlist-button"
          >
            <Feather name="list" size={19} color={colors.mutedForeground} />
          </Pressable>
          {poem.recording ? (
            <Pressable
              onPress={() => setFocusModeVisible(true)}
              hitSlop={12}
              testID="player-focus-mode-button"
            >
              <Feather name="maximize" size={19} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
          <Pressable onPress={handleDelete} hitSlop={12} testID="player-delete-button">
            <Feather name="trash-2" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <View style={styles.headerText}>
        {poem.coverImageUrl ? (
          <Image
            source={poem.coverImageUrl}
            style={styles.coverImage}
            contentFit="cover"
            transition={180}
          />
        ) : null}
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

          const { first, second } = splitHemistichs(verse.text);
          const confidence = verse.alignment?.confidence;
          const confidenceColor =
            confidence === undefined
              ? colors.mutedForeground
              : confidence >= 0.8
                ? '#34d399'
                : confidence >= 0.65
                  ? '#fbbf24'
                  : colors.destructive;

          return (
            <Pressable
              key={verse.id}
              onPress={() =>
                verse.alignment ? seekToVerse(verse.alignment.startMs) : undefined
              }
              onLongPress={() => startEditVerse(verse)}
              style={[
                styles.verseCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isActive ? colors.primary : colors.border,
                },
                isActive && { backgroundColor: colors.accent },
              ]}
            >
              <View style={styles.verseMetaRow}>
                <View style={styles.verseMetaBadges}>
                  <View
                    style={[
                      styles.verseNumberBadge,
                      {
                        backgroundColor: isActive ? colors.primary : colors.secondary,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.verseNumberText,
                        { color: isActive ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {verse.orderIndex + 1}
                    </Text>
                  </View>
                  {verse.alignment ? (
                    <View style={[styles.verseTimeBadge, { borderColor: colors.border }]}>
                      <Feather name="volume-2" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.verseTimeText, { color: colors.mutedForeground }]}>
                        {formatDuration(verse.alignment.startMs)}
                      </Text>
                    </View>
                  ) : null}
                  {confidence !== undefined ? (
                    <View
                      style={[
                        styles.verseTimeBadge,
                        { borderColor: confidenceColor + '40' },
                      ]}
                    >
                      <Feather name="check-circle" size={11} color={confidenceColor} />
                      <Text style={[styles.verseTimeText, { color: confidenceColor }]}>
                        {Math.round(confidence * 100)}%
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.verseActionsRow}>
                  <Pressable
                    onPress={() => startEditVerse(verse)}
                    hitSlop={10}
                    testID={`verse-edit-button-${verse.id}`}
                  >
                    <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable
                    onPress={() => setShareVerseIndex(poem.verses.findIndex((v) => v.id === verse.id))}
                    hitSlop={10}
                    testID={`verse-share-button-${verse.id}`}
                  >
                    <Feather name="share-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteVerse(verse)}
                    hitSlop={10}
                    testID={`verse-delete-button-${verse.id}`}
                  >
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.verseHemistichBlock}>
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
                  {first}
                </Text>
                {second ? (
                  <>
                    <View style={styles.verseDivider}>
                      <Feather name="star" size={10} color={colors.primary} />
                    </View>
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
                      {second}
                    </Text>
                  </>
                ) : null}
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

      {shareVerseIndex !== null ? (
        <VerseShareModal
          poem={poem}
          initialVerseIndex={shareVerseIndex}
          onClose={() => setShareVerseIndex(null)}
        />
      ) : null}

      <Modal
        visible={focusModeVisible}
        animationType="fade"
        onRequestClose={() => setFocusModeVisible(false)}
      >
        <View style={[styles.focusContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.focusTopBar, { paddingTop: topInset + 12 }]}>
            <Pressable
              onPress={() => setFocusModeVisible(false)}
              hitSlop={12}
              testID="focus-exit-button"
            >
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
            <View style={styles.focusFontControls}>
              <Pressable
                onPress={() => setFontSize(fontSize - 2)}
                hitSlop={10}
                testID="focus-font-decrease"
              >
                <Feather name="minus" size={16} color={colors.mutedForeground} />
              </Pressable>
              <Pressable
                onPress={() => setFontSize(fontSize + 2)}
                hitSlop={10}
                testID="focus-font-increase"
              >
                <Feather name="plus" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={focusScrollRef}
            contentContainerStyle={styles.focusScrollContent}
          >
            <Text style={[styles.focusPoemTitle, { color: colors.primary }]}>
              {poem.title}
            </Text>
            {poem.verses.map((verse) => {
              const isActive = verse.id === activeVerseId;
              const { first, second } = splitHemistichs(verse.text);
              return (
                <Pressable
                  key={verse.id}
                  onLayout={(e) => {
                    focusVerseOffsets.current[verse.id] = e.nativeEvent.layout.y;
                  }}
                  onPress={() => verse.alignment && seekToVerse(verse.alignment.startMs)}
                  testID={`focus-verse-${verse.id}`}
                  style={styles.focusVerseRow}
                >
                  <Text
                    style={[
                      styles.focusVerseText,
                      {
                        fontSize: fontSize + 6,
                        lineHeight: (fontSize + 6) * 1.8,
                        color: isActive ? colors.foreground : colors.mutedForeground,
                        fontFamily: isActive ? 'Amiri_700Bold' : 'Amiri_400Regular',
                      },
                    ]}
                  >
                    {first}
                  </Text>
                  {second ? (
                    <>
                      <View style={styles.focusVerseDivider}>
                        <Feather
                          name="star"
                          size={12}
                          color={isActive ? colors.primary : colors.mutedForeground}
                        />
                      </View>
                      <Text
                        style={[
                          styles.focusVerseText,
                          {
                            fontSize: fontSize + 6,
                            lineHeight: (fontSize + 6) * 1.8,
                            color: isActive ? colors.foreground : colors.mutedForeground,
                            fontFamily: isActive ? 'Amiri_700Bold' : 'Amiri_400Regular',
                          },
                        ]}
                      >
                        {second}
                      </Text>
                    </>
                  ) : null}
                </Pressable>
              );
            })}
            <View style={{ height: 140 }} />
          </ScrollView>

          <Pressable
            onPress={togglePlay}
            testID="focus-play-pause"
            style={[styles.focusPlayButton, { backgroundColor: colors.primary }]}
          >
            <Feather
              name={status.playing ? 'pause' : 'play'}
              size={24}
              color={colors.primaryForeground}
            />
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={playlistModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPlaylistModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.background, paddingBottom: bottomInset + 20 },
            ]}
          >
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setPlaylistModalVisible(false)} hitSlop={12}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                إضافة إلى قائمة تشغيل
              </Text>
            </View>

            <ScrollView style={styles.modalList}>
              {playlists.length === 0 ? (
                <Text style={[styles.modalEmpty, { color: colors.mutedForeground }]}>
                  لا توجد قوائم تشغيل بعد
                </Text>
              ) : (
                playlists.map((playlist) => {
                  const included = playlist.poemIds.includes(poem.id);
                  return (
                    <Pressable
                      key={playlist.id}
                      onPress={() =>
                        included
                          ? removePoemFromPlaylist(playlist.id, poem.id)
                          : addPoemToPlaylist(playlist.id, poem.id)
                      }
                      style={[styles.modalRow, { borderColor: colors.border }]}
                      testID={`playlist-toggle-${playlist.id}`}
                    >
                      <Feather
                        name={included ? 'check-square' : 'square'}
                        size={18}
                        color={included ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[styles.modalRowText, { color: colors.foreground }]}>
                        {playlist.name}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <View
              style={[
                styles.createRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                placeholder="قائمة تشغيل جديدة"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.createInput, { color: colors.foreground, fontFamily: 'Cairo_400Regular' }]}
                textAlign="right"
                testID="new-playlist-input"
              />
              <Pressable
                onPress={async () => {
                  const trimmed = newPlaylistName.trim();
                  if (!trimmed) return;
                  const playlist = await createPlaylist(trimmed);
                  await addPoemToPlaylist(playlist.id, poem.id);
                  setNewPlaylistName('');
                }}
                hitSlop={10}
                testID="new-playlist-confirm"
              >
                <Feather name="plus" size={18} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '75%',
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
  },
  modalList: {
    maxHeight: 260,
  },
  modalEmpty: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalRowText: {
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  createRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 44,
  },
  createInput: {
    flex: 1,
    fontSize: 15,
  },
  focusContainer: {
    flex: 1,
  },
  focusTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  focusFontControls: {
    flexDirection: 'row',
    gap: 16,
  },
  focusScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
  },
  focusPoemTitle: {
    fontSize: 20,
    fontFamily: 'Amiri_700Bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  focusVerseRow: {
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  focusVerseText: {
    textAlign: 'center',
  },
  focusVerseDivider: {
    paddingVertical: 4,
  },
  focusPlayButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 2,
  },
  coverImage: {
    width: '100%',
    height: 210,
    borderRadius: 16,
    marginBottom: 12,
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
  verseCard: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  verseMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verseMetaBadges: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  verseNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  verseNumberText: {
    fontSize: 11,
    fontFamily: 'Cairo_700Bold',
  },
  verseTimeBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  verseTimeText: {
    fontSize: 10,
    fontFamily: 'Cairo_400Regular',
  },
  verseHemistichBlock: {
    alignItems: 'center',
    marginTop: 12,
    gap: 2,
  },
  verseDivider: {
    paddingVertical: 6,
  },
  verseText: {
    fontFamily: 'Amiri_400Regular',
    textAlign: 'center',
  },
  verseActionsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    gap: 16,
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
