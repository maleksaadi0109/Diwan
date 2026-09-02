import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { usePlaylists } from '@/contexts/PlaylistsContext';
import { EmptyState } from '@/components/EmptyState';
import type { Playlist } from '@/lib/types';

export default function PlaylistsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playlists, isLoading, createPlaylist } = usePlaylists();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : 0;

  const submitCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    const playlist = await createPlaylist(trimmed);
    setName('');
    setCreating(false);
    router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } });
  };

  const renderItem = ({ item }: { item: Playlist }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
      testID={`playlist-card-${item.id}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
        <Feather name="list" size={16} color={colors.accentForeground} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
          {item.poemIds.length} قصيدة
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => setCreating((v) => !v)}
            hitSlop={12}
            testID="playlists-create-toggle"
          >
            <Feather name="plus-circle" size={24} color={colors.primary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            قوائم التشغيل
          </Text>
        </View>
        {creating ? (
          <View
            style={[
              styles.createRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="اسم قائمة التشغيل"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.createInput, { color: colors.foreground, fontFamily: 'Cairo_400Regular' }]}
              textAlign="right"
              autoFocus
              onSubmitEditing={submitCreate}
              testID="playlist-name-input"
            />
            <Pressable onPress={submitCreate} hitSlop={10} testID="playlist-create-confirm">
              <Feather name="check" size={18} color={colors.primary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {!isLoading && playlists.length === 0 && !creating ? (
        <EmptyState
          icon="list"
          title="لا توجد قوائم تشغيل"
          subtitle="أنشئ قائمة تشغيل جديدة لتنظيم قصائدك المفضلة"
        />
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + bottomInset }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Amiri_700Bold',
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
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
});
