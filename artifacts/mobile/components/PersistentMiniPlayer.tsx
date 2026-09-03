import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useColors } from '@/hooks/useColors';
import { useGlobalAudioPlayer } from '@/contexts/AudioPlayerContext';

export function PersistentMiniPlayer() {
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { activePoem, player, status } = useGlobalAudioPlayer();

  if (!activePoem?.recording || pathname.startsWith('/poem/')) return null;

  const isTabScreen =
    pathname === '/' ||
    pathname === '/import' ||
    pathname === '/playlists' ||
    pathname === '/settings';
  const bottom = isTabScreen ? 72 + insets.bottom : 12 + insets.bottom;
  const durationMs = activePoem.recording.durationMs || (status.duration ?? 0) * 1000;
  const progress =
    durationMs > 0
      ? Math.min(1, Math.max(0, ((status.currentTime ?? 0) * 1000) / durationMs))
      : 0;

  const togglePlay = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  return (
    <View
      style={[
        styles.container,
        {
          bottom,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRightColor: colors.primary,
          shadowColor: colors.background,
        },
      ]}
      testID="persistent-mini-player"
    >
      <Pressable
        onPress={() =>
          router.push({ pathname: '/poem/[id]', params: { id: activePoem.id } })
        }
        style={styles.poemLink}
        accessibilityLabel={`فتح قصيدة ${activePoem.title}`}
        testID="persistent-mini-player-open"
      >
        {activePoem.coverImageUrl ? (
          <Image
            source={{ uri: activePoem.coverImageUrl }}
            style={styles.cover}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.coverFallback, { backgroundColor: colors.accent }]}>
            <Feather name="music" size={16} color={colors.primary} />
          </View>
        )}
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
            {activePoem.title}
          </Text>
          <Text style={[styles.poet, { color: colors.mutedForeground }]} numberOfLines={1}>
            {activePoem.poetName}
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={togglePlay}
        hitSlop={10}
        style={[styles.playButton, { backgroundColor: colors.primary }]}
        accessibilityLabel={status.playing ? 'إيقاف مؤقت' : 'تشغيل'}
        testID="persistent-mini-player-play-pause"
      >
        <Feather
          name={status.playing ? 'pause' : 'play'}
          size={19}
          color={colors.primaryForeground}
        />
      </Pressable>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${progress * 100}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    minHeight: 64,
    borderWidth: 1,
    borderRightWidth: 3,
    borderRadius: 14,
    padding: 7,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 100,
  },
  poemLink: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  coverFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 17,
    fontFamily: 'Amiri_700Bold',
    textAlign: 'right',
  },
  poet: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    textAlign: 'right',
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    height: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    alignSelf: 'flex-end',
  },
});