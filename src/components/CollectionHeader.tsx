import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Artwork } from './Artwork';
import { IconButton } from './IconButton';
import { useArtworkColor } from './useArtworkColor';

interface Props {
  title: string;
  subtitle?: string;
  meta?: string;
  artworkUrl: string | null;
  /** Custom cover, e.g. the Liked Songs gradient heart or a playlist mosaic. */
  cover?: ReactNode;
  round?: boolean;
  onBack?: () => void;
  onPlay?: () => void;
  onShuffle?: () => void;
  actions?: ReactNode;
  tint?: string;
}

/** Spotify-style header: artwork-coloured gradient, big cover, title and play button. */
export function CollectionHeader({ title, subtitle, meta, artworkUrl, cover, round, onBack, onPlay, onShuffle, actions, tint }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { accent } = useTheme();
  const extracted = useArtworkColor(tint ? null : artworkUrl);
  const color = tint ?? extracted;
  const size = Math.min(240, width * 0.6);

  return (
    <LinearGradient colors={[color, palette.bg]} locations={[0, 0.95]} style={{ paddingTop: insets.top + 8 }}>
      {onBack && <IconButton name="chevron-back" size={28} onPress={onBack} style={styles.back} accessibilityLabel="Back" />}
      <View style={styles.coverWrap}>
        {cover ?? <Artwork uri={artworkUrl} size={size} round={round} radius={6} style={styles.cover} />}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        <View style={styles.row}>
          <View style={styles.actions}>{actions}</View>
          {onShuffle && (
            <IconButton name="shuffle" size={28} color={palette.textSecondary} onPress={onShuffle} style={styles.shuffle} accessibilityLabel="Shuffle play" />
          )}
          {onPlay && (
            <Pressable
              onPress={onPlay}
              accessibilityLabel="Play"
              style={({ pressed }) => [styles.play, { backgroundColor: accent, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
            >
              <Ionicons name="play" size={28} color="#000" style={styles.playIcon} />
            </Pressable>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  back: { position: 'absolute', left: 8, zIndex: 2, top: 8, padding: 8 },
  coverWrap: { alignItems: 'center', paddingTop: 36, paddingBottom: 20 },
  cover: { elevation: 16, shadowColor: '#000' },
  body: { paddingHorizontal: 16 },
  title: { color: palette.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: palette.text, fontSize: 14, fontWeight: '600', marginTop: 8 },
  meta: { color: palette.textSecondary, fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  actions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 20 },
  shuffle: { marginRight: 18 },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  playIcon: { marginLeft: 3 },
});
