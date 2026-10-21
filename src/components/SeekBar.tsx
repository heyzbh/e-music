import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { formatDuration } from '../utils/text';

interface Props {
  positionMs: number;
  bufferedMs: number;
  durationMs: number | null;
  onSeek: (ms: number) => void;
  color: string;
  trackColor?: string;
}

const TOUCH_HEIGHT = 36;

/**
 * Draggable, tappable progress bar. While dragging, the thumb and time labels follow the
 * finger and the seek happens on release, so audio never stutters mid-scrub.
 */
export function SeekBar({ positionMs, bufferedMs, durationMs, onSeek, color, trackColor = 'rgba(255,255,255,0.25)' }: Props) {
  const width = useSharedValue(0);
  const progress = useSharedValue(0);
  const dragging = useSharedValue(false);
  const active = useSharedValue(0);
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  // Ignore stale polled positions right after a seek until the player catches up.
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);

  const duration = durationMs && durationMs > 0 ? durationMs : 0;

  useEffect(() => {
    if (pendingSeek != null && Math.abs(positionMs - pendingSeek) < 1500) setPendingSeek(null);
  }, [positionMs, pendingSeek]);

  useEffect(() => {
    if (!dragging.value && pendingSeek == null && duration > 0) {
      progress.value = Math.min(1, positionMs / duration);
    }
  }, [positionMs, duration, pendingSeek, dragging, progress]);

  const finish = (ratio: number) => {
    setScrubMs(null);
    if (duration > 0) {
      const ms = ratio * duration;
      setPendingSeek(ms);
      setTimeout(() => setPendingSeek(null), 3000);
      onSeek(ms);
    }
  };

  const updateLabel = (ratio: number) => setScrubMs(ratio * duration);

  const pan = Gesture.Pan()
    .minDistance(0)
    .hitSlop({ vertical: 8 })
    .onBegin((e) => {
      if (width.value <= 0) return;
      dragging.value = true;
      active.value = withTiming(1, { duration: 120 });
      progress.value = Math.min(1, Math.max(0, e.x / width.value));
      scheduleOnRN(updateLabel, progress.value);
    })
    .onUpdate((e) => {
      if (width.value <= 0) return;
      progress.value = Math.min(1, Math.max(0, e.x / width.value));
      scheduleOnRN(updateLabel, progress.value);
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      dragging.value = false;
      active.value = withTiming(0, { duration: 160 });
      scheduleOnRN(finish, progress.value);
    });

  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * width.value }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * width.value - 7 }, { scale: 1 + active.value * 0.45 }],
  }));
  const barStyle = useAnimatedStyle(() => ({ height: 4 + active.value * 2 }));

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  const bufferedRatio = duration > 0 ? Math.min(1, bufferedMs / duration) : 0;
  const shownMs = scrubMs ?? pendingSeek ?? positionMs;

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View style={styles.touch} onLayout={onLayout}>
          <Animated.View style={[styles.bar, { backgroundColor: trackColor }, barStyle]}>
            <View style={[styles.buffered, { width: `${bufferedRatio * 100}%` }]} />
            <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
          </Animated.View>
          <Animated.View style={[styles.thumb, { backgroundColor: color }, thumbStyle]} />
        </View>
      </GestureDetector>
      <View style={styles.times}>
        <Text style={styles.time}>{formatDuration(shownMs)}</Text>
        <Text style={styles.time}>{duration > 0 ? formatDuration(duration) : '--:--'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { height: TOUCH_HEIGHT, justifyContent: 'center' },
  bar: { borderRadius: 3, overflow: 'hidden', justifyContent: 'center' },
  buffered: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.18)' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  thumb: { position: 'absolute', left: 0, width: 14, height: 14, borderRadius: 7 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontVariant: ['tabular-nums'] },
});
