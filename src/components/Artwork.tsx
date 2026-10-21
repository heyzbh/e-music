import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radius as radii } from '../theme/colors';

interface Props {
  uri: string | null | undefined;
  size: number;
  round?: boolean;
  radius?: number;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

/** Cover art with a tasteful placeholder for tracks that have none (or fail to load). */
function ArtworkImpl({ uri, size, round, radius = radii.sm, icon = 'musical-notes', style }: Props) {
  const [failed, setFailed] = useState(false);
  const borderRadius = round ? size / 2 : radius;
  const box = { width: size, height: size, borderRadius };

  return (
    <View style={[box, styles.box, style]}>
      <LinearGradient colors={['#2c2c34', '#1a1a1f']} style={[StyleSheet.absoluteFill, styles.center]}>
        <Ionicons name={round ? 'person' : icon} size={size * 0.4} color={palette.textTertiary} />
      </LinearGradient>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

export const Artwork = memo(ArtworkImpl);

const styles = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: palette.elevated },
  center: { alignItems: 'center', justifyContent: 'center' },
});
