import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import type { Poem } from '@/lib/types';

interface PoemCardProps {
  poem: Poem;
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
}

export function PoemCard({ poem, onPress, onLongPress, testID }: PoemCardProps) {
  const colors = useColors();
  const preview = poem.verses[0]?.text ?? '';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID ?? `poem-card-${poem.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRightColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {poem.coverImageUrl ? (
        <Image
          source={poem.coverImageUrl}
          style={styles.cover}
          contentFit="cover"
          transition={180}
        />
      ) : null}

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text
              style={[styles.title, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {poem.title}
            </Text>
            <Text
              style={[styles.poet, { color: colors.primary }]}
              numberOfLines={1}
            >
              {poem.poetName}
            </Text>
          </View>
          {poem.recording ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Feather name="play" size={12} color={colors.primary} style={{ marginLeft: 2 }} />
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
              <Feather name="book-open" size={12} color={colors.mutedForeground} />
            </View>
          )}
        </View>

        {preview ? (
          <Text
            style={[styles.preview, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {preview}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderRightWidth: 3,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
  },
  cover: {
    width: 80,
    height: '100%',
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
  },
  poet: {
    fontSize: 12,
    fontFamily: 'Cairo_600SemiBold',
    textAlign: 'right',
  },
  preview: {
    fontSize: 15,
    fontFamily: 'Amiri_400Regular',
    textAlign: 'right',
    lineHeight: 26,
  },
});
