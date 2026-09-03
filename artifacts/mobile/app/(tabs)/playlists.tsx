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
  const tabBarHeight = Platform.OS === 'web' ? 84 : 64 + insets.bottom;

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
      <View style={[styles.badge, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
        <Feather name="list" size={16} color={colors.primary} />
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
          {item.poemIds.length} قصيدة
        </Text>
      </View>
      <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            قوائم التشغيل
          </Text>
          <Pressable
            onPress={() => setCreating((v) => !v)}
            hitSlop={12}
            testID="playlists-create-toggle"
          >
            <Feather name="plus-circle" size={24} color={colors.primary} />
          </Pressable>
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
          contentContainerStyle={[styles.list, { paddingBottom: 24 + tabBarHeight }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
  },
  createRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 48,
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
    gap: 16,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'right',
  },
});
