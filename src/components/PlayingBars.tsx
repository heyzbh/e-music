import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

function Bar({ color, delay, active }: { color: string; delay: number; active: boolean }) {
  const h = useSharedValue(0.35);

  useEffect(() => {
    if (active) {
      h.value = withDelay(
        delay,
        withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }), -1, true),
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(0.35, { duration: 200 });
    }
  }, [active, delay, h]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

/** Equaliser-style indicator next to the track that is currently playing. */
export function PlayingBars({ color, active }: { color: string; active: boolean }) {
  return (
    <View style={styles.row}>
      <Bar color={color} delay={0} active={active} />
      <Bar color={color} delay={160} active={active} />
      <Bar color={color} delay={80} active={active} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', height: 14, width: 14, gap: 2, marginRight: 8 },
  bar: { flex: 1, height: 14, borderRadius: 1 },
});
