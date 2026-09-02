import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLibrary } from '@/contexts/LibraryContext';
import { usePlaylists } from '@/contexts/PlaylistsContext';
import { PoemCard } from '@/components/PoemCard';
import { EmptyState } from '@/components/EmptyState';
import type { Poem } from '@/lib/types';

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getPoem } = useLibrary();
  const { getPlaylist, renamePlaylist, deletePlaylist, removePoemFromPlaylist } =
    usePlaylists();
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const playlist = getPlaylist(id);
  const poems = useMemo(
    () =>
      (playlist?.poemIds ?? [])
        .map((poemId) => getPoem(poemId))
        .filter((p): p is Poem => Boolean(p)),
    [playlist, getPoem],
  );

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : 0;

  if (!playlist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-right" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.centerFill}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Cairo_400Regular' }}>
            قائمة التشغيل غير موجودة
          </Text>
        </View>
      </View>
    );
  }

  const startRename = () => {
    setNameDraft(playlist.name);
    setIsRenaming(true);
  };

  const saveRename = async () => {
    const trimmed = nameDraft.trim();
    if (trimmed) await renamePlaylist(playlist.id, trimmed);
    setIsRenaming(false);
  };

  const handleDeletePlaylist = () => {
    Alert.alert('حذف قائمة التشغيل', `هل تريد حذف "${playlist.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await deletePlaylist(playlist.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="playlist-back-button">
          <Feather name="arrow-right" size={22} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={handleDeletePlaylist} hitSlop={12} testID="playlist-delete-button">
          <Feather name="trash-2" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.headerText}>
        {isRenaming ? (
          <View style={styles.renameRow}>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              textAlign="right"
              onSubmitEditing={saveRename}
              style={[styles.title, { color: colors.foreground, fontFamily: 'Cairo_700Bold' }]}
              testID="playlist-rename-input"
            />
            <Pressable onPress={saveRename} hitSlop={10} testID="playlist-rename-confirm">
              <Feather name="check" size={18} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={startRename} testID="playlist-rename-trigger">
            <Text style={[styles.title, { color: colors.foreground }]}>{playlist.name}</Text>
          </Pressable>
        )}
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {poems.length} قصيدة
        </Text>
      </View>

      {poems.length === 0 ? (
        <EmptyState
          icon="music"
          title="لا توجد قصائد في هذه القائمة"
          subtitle="أضف قصائد من المكتبة عبر زر «إضافة إلى قائمة تشغيل»"
        />
      ) : (
        <FlatList
          data={poems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.poemRow}>
              <View style={{ flex: 1 }}>
                <PoemCard
                  poem={item}
                  onPress={() =>
                    router.push({ pathname: '/poem/[id]', params: { id: item.id } })
                  }
                />
              </View>
              <Pressable
                onPress={() => removePoemFromPlaylist(playlist.id, item.id)}
                hitSlop={10}
                style={styles.removeButton}
                testID={`playlist-remove-poem-${item.id}`}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + bottomInset }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerText: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 2,
  },
  renameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  poemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  removeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
