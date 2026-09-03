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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLibrary } from '@/contexts/LibraryContext';
import { PoemCard } from '@/components/PoemCard';
import { EmptyState } from '@/components/EmptyState';
import { AddPoemsToPlaylistModal } from '@/components/AddPoemsToPlaylistModal';
import { normalizeArabic } from '@/lib/utils';
import type { Poem } from '@/lib/types';

export default function LibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { poems, isLoading, removePoem } = useLibrary();
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPlaylistModalVisible, setBulkPlaylistModalVisible] = useState(false);

  const filtered = useMemo(() => {
    const q = normalizeArabic(query.trim());
    if (!q) return poems;
    return poems.filter((p) => {
      if (normalizeArabic(p.title).includes(q)) return true;
      if (normalizeArabic(p.poetName).includes(q)) return true;
      return p.verses.some((v) => normalizeArabic(v.text).includes(q));
    });
  }, [poems, query]);

  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : 0;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    Alert.alert(
      'حذف القصائد',
      `هل تريد حذف ${selectedIds.size} قصيدة من مكتبتك؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              await removePoem(id);
            }
            exitSelectMode();
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Poem }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <View style={styles.selectableRow}>
        {selectMode ? (
          <Feather
            name={isSelected ? 'check-square' : 'square'}
            size={20}
            color={isSelected ? colors.primary : colors.mutedForeground}
            style={styles.selectCheckbox}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <PoemCard
            poem={item}
            testID={`library-item-${item.id}`}
            onPress={() =>
              selectMode
                ? toggleSelected(item.id)
                : router.push({ pathname: '/poem/[id]', params: { id: item.id } })
            }
            onLongPress={() => {
              if (!selectMode) setSelectMode(true);
              toggleSelected(item.id);
            }}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <View style={styles.headerTopRow}>
          {poems.length > 0 ? (
            <Pressable
              onPress={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              hitSlop={10}
              testID="library-select-toggle"
            >
              <Text style={[styles.selectToggleText, { color: colors.primary }]}>
                {selectMode ? 'إلغاء' : 'تحديد'}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            ديوان
          </Text>
        </View>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
          مكتبتك من القصائد
        </Text>
        {poems.length > 0 && !selectMode ? (
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
            { paddingBottom: (selectMode ? 90 : 24) + bottomInset },
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

      {selectMode && selectedIds.size > 0 ? (
        <View
          style={[
            styles.bulkBar,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: 12 + bottomInset,
            },
          ]}
        >
          <Text style={[styles.bulkCount, { color: colors.foreground }]}>
            {selectedIds.size} محددة
          </Text>
          <View style={styles.bulkActions}>
            <Pressable
              onPress={() => setBulkPlaylistModalVisible(true)}
              hitSlop={10}
              testID="library-bulk-add-to-playlist"
            >
              <Feather name="list" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Pressable onPress={handleBulkDelete} hitSlop={10} testID="library-bulk-delete">
              <Feather name="trash-2" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {bulkPlaylistModalVisible ? (
        <AddPoemsToPlaylistModal
          poemIds={Array.from(selectedIds)}
          onClose={() => {
            setBulkPlaylistModalVisible(false);
            exitSelectMode();
          }}
        />
      ) : null}
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
  headerTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectToggleText: {
    fontSize: 14,
    fontFamily: 'Cairo_600SemiBold',
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  selectableRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  selectCheckbox: {
    marginTop: 2,
  },
  bulkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bulkCount: {
    fontSize: 14,
    fontFamily: 'Cairo_600SemiBold',
  },
  bulkActions: {
    flexDirection: 'row-reverse',
    gap: 20,
  },
});
