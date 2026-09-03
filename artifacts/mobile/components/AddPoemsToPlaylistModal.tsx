import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { usePlaylists } from '@/contexts/PlaylistsContext';

interface AddPoemsToPlaylistModalProps {
  poemIds: string[];
  onClose: () => void;
}

export function AddPoemsToPlaylistModal({
  poemIds,
  onClose,
}: AddPoemsToPlaylistModalProps) {
  const colors = useColors();
  const { playlists, createPlaylist, addPoemsToPlaylist } = usePlaylists();
  const [newName, setNewName] = useState('');

  const addAllTo = async (playlistId: string) => {
    await addPoemsToPlaylist(playlistId, poemIds);
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: Platform.OS === 'web' ? 34 : 20,
            },
          ]}
        >
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} testID="bulk-playlist-close">
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.title, { color: colors.foreground }]}>
              إضافة {poemIds.length} قصيدة إلى قائمة
            </Text>
          </View>

          <ScrollView style={styles.list}>
            {playlists.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                لا توجد قوائم تشغيل بعد
              </Text>
            ) : (
              playlists.map((playlist) => (
                <Pressable
                  key={playlist.id}
                  onPress={() => addAllTo(playlist.id)}
                  style={[styles.row, { borderColor: colors.border }]}
                  testID={`bulk-playlist-target-${playlist.id}`}
                >
                  <Feather name="list" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.rowText, { color: colors.foreground }]}>
                    {playlist.name}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <View
            style={[
              styles.createRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="قائمة تشغيل جديدة"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.createInput, { color: colors.foreground, fontFamily: 'Cairo_400Regular' }]}
              textAlign="right"
              testID="bulk-new-playlist-input"
            />
            <Pressable
              onPress={async () => {
                const trimmed = newName.trim();
                if (!trimmed) return;
                await createPlaylist(trimmed, poemIds);
                onClose();
              }}
              hitSlop={10}
              testID="bulk-new-playlist-confirm"
            >
              <Feather name="plus" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  card: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 24,
    paddingTop: 20,
    maxHeight: '75%',
    gap: 16,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
    flex: 1,
    marginRight: 12,
  },
  list: {
    maxHeight: 300,
  },
  empty: {
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  rowText: {
    fontSize: 16,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  createRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 20,
  },
  createInput: {
    flex: 1,
    fontSize: 15,
  },
});
