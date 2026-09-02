import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Poem } from '@/lib/types';

interface PoemCardProps {
  poem: Poem;
  onPress: () => void;
}

export function PoemCard({ poem, onPress }: PoemCardProps) {
  const colors = useColors();
  const preview = poem.verses[0]?.text ?? '';

  return (
    <Pressable
      onPress={onPress}
      testID={`poem-card-${poem.id}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Feather name="feather" size={14} color={colors.accentForeground} />
        </View>
        <View style={styles.headerText}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {poem.title}
          </Text>
          <Text
            style={[styles.poet, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {poem.poetName}
          </Text>
        </View>
        {poem.recording ? (
          <Feather name="play-circle" size={20} color={colors.primary} />
        ) : null}
      </View>
      {preview ? (
        <Text
          style={[styles.preview, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {preview}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    textAlign: 'right',
  },
  poet: {
    fontSize: 13,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  preview: {
    fontSize: 14,
    fontFamily: 'Amiri_400Regular',
    textAlign: 'right',
    lineHeight: 22,
  },
});
