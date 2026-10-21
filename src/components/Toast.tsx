import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { palette, radius } from '../theme/colors';

type Listener = (message: string) => void;
let listener: Listener | null = null;

export function showToast(message: string): void {
  listener?.(message);
}

/** Small confirmation above the mini player ("Added to queue"). Mount once at the root. */
export function ToastHost({ bottomOffset }: { bottomOffset: number }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    listener = (message) => setToast({ id: Date.now(), message });
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="none"
      style={[styles.toast, { bottom: bottomOffset }]}
    >
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: palette.text,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 6,
  },
  text: { color: '#000', fontWeight: '600', fontSize: 14 },
});
