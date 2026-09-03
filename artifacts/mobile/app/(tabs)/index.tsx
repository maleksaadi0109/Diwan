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
  const { poems, isLoading, removePoems } = useLibrary();
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
  const tabBarHeight = Platform.OS === 'web' ? 84 : 64 + insets.bottom;

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
    const selected = Array.from(selectedIds);
    const deleteSelected = async () => {
      await removePoems(selected);
      exitSelectMode();
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`هل تريد حذف ${selected.length} قصيدة من مكتبتك؟`)) {
        void deleteSelected();
      }
      return;
    }
    Alert.alert(
      'حذف القصائد',
      `هل تريد حذف ${selected.length} قصيدة من مكتبتك؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: deleteSelected,
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
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            ديوان
          </Text>
          {poems.length > 0 && selectMode ? (
            <View style={styles.selectionHeaderActions}>
              <Pressable
                onPress={() => setSelectedIds(new Set(filtered.map((poem) => poem.id)))}
                hitSlop={10}
                testID="library-select-all"
              >
                <Text style={[styles.selectToggleText, { color: colors.primary }]}>
                  تحديد الكل
                </Text>
              </Pressable>
              <Pressable onPress={exitSelectMode} hitSlop={10} testID="library-cancel-selection">
                <Text style={[styles.selectToggleText, { color: colors.mutedForeground }]}>
                  إلغاء
                </Text>
              </Pressable>
            </View>
          ) : poems.length > 0 ? (
            <Pressable
              onPress={() => setSelectMode(true)}
              hitSlop={10}
              testID="library-select-toggle"
            >
              <Text style={[styles.selectToggleText, { color: colors.primary }]}>
                تحديد
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
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
            { paddingBottom: (selectMode ? 90 : 24) + tabBarHeight },
            filtered.length === 0 && { flex: 1, justifyContent: 'center' }
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
              bottom: tabBarHeight + 20,
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
              style={styles.bulkActionButton}
            >
              <Feather name="list" size={20} color={colors.mutedForeground} />
              <Text style={[styles.bulkActionText, { color: colors.mutedForeground }]}>
                إضافة إلى قائمة
              </Text>
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
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 8,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
  },
  headerSubtitle: {
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 48,
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
  selectionHeaderActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 20,
  },
  selectToggleText: {
    fontSize: 15,
    fontFamily: 'Cairo_600SemiBold',
  },
  list: {
    paddingHorizontal: 20,
    gap: 16,
  },
  selectableRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  selectCheckbox: {
    marginTop: 2,
  },
  bulkBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  bulkCount: {
    fontSize: 15,
    fontFamily: 'Cairo_700Bold',
  },
  bulkActions: {
    flexDirection: 'row-reverse',
    gap: 24,
  },
  bulkActionButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  bulkActionText: {
    fontSize: 13,
    fontFamily: 'Cairo_700Bold',
  },
});
