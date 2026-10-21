import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { palette } from '../theme/colors';

interface Props {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function IconButton({ name, onPress, size = 24, color = palette.text, style, disabled, accessibilityLabel }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: true, radius: size }}
      style={({ pressed }) => [styles.base, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
