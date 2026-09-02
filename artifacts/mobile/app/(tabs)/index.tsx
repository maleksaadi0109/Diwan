import React, { useMemo, useState } from 'react';
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
import { useLibrary } from '@/contexts/LibraryContext';
import { PoemCard } from '@/components/PoemCard';
import { EmptyState } from '@/components/EmptyState';
import type { Poem } from '@/lib/types';

export default function LibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { poems, isLoading } = useLibrary();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return poems;
    return poems.filter(
      (p) => p.title.includes(q) || p.poetName.includes(q),
    );
  }, [poems, query]);

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : 0;

  const renderItem = ({ item }: { item: Poem }) => (
    <PoemCard
      poem={item}
      onPress={() => router.push({ pathname: '/poem/[id]', params: { id: item.id } })}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          ديوان
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
          مكتبتك من القصائد
        </Text>
        {poems.length > 0 ? (
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ابحث عن قصيدة أو شاعر"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.searchInput,
                { color: colors.foreground, fontFamily: 'Cairo_400Regular' },
              ]}
              textAlign="right"
              testID="library-search-input"
            />
          </View>
        ) : null}
      </View>

      {!isLoading && poems.length === 0 ? (
        <EmptyState
          icon="book-open"
          title="مكتبتك فارغة"
          subtitle="استورد أول قصيدة من تبويب الاستيراد لتبدأ الاستماع والقراءة"
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 24 + bottomInset },
          ]}
          scrollEnabled={filtered.length > 0}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title="لا توجد نتائج"
              subtitle="جرّب كلمة بحث أخرى"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
});
