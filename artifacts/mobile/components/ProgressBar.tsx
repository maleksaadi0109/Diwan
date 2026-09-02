import React, { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

interface ProgressBarProps {
  progress: number; // 0..1
  onSeek: (ratio: number) => void;
}

export function ProgressBar({ progress, onSeek }: ProgressBarProps) {
  const colors = useColors();
  const widthRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    widthRef.current = event.nativeEvent.layout.width;
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const seekAtX = (x: number) => {
    const width = widthRef.current;
    if (width <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / width));
    onSeek(ratio);
  };

  const tap = Gesture.Tap().onEnd((e) => {
    runOnJS(seekAtX)(e.x);
  });
  const pan = Gesture.Pan().onUpdate((e) => {
    runOnJS(seekAtX)(e.x);
  });
  const gesture = Gesture.Race(tap, pan);

  const clampedProgress = Math.min(1, Math.max(0, progress));

  return (
    <GestureDetector gesture={gesture}>
      <View
        onLayout={handleLayout}
        style={[styles.track, { backgroundColor: colors.secondary }]}
        testID="player-progress-bar"
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primary,
              width: trackWidth * clampedProgress,
            },
          ]}
        />
        <View
          style={[
            styles.thumb,
            {
              backgroundColor: colors.primary,
              left: Math.max(0, trackWidth * clampedProgress - 7),
            },
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
