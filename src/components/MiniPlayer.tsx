import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { setLiked, useLikedIds } from '../db/library';
import { navigationRef, type RootParams } from '../navigation/types';
import { togglePlay } from '../playback/actions';
import { usePlayer, usePlayerProgress } from '../playback/hooks';
import { palette, radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Artwork } from './Artwork';
import { IconButton } from './IconButton';
import { useArtworkColor } from './useArtworkColor';

export const MINI_PLAYER_HEIGHT = 60;

/** Floating bar above the tabs; tap to open the full player. */
export function MiniPlayer() {
  const navigation = useNavigation<NavigationProp<RootParams>>();
  const player = usePlayer();
  // The full player covers the tabs; stop polling progress while it is open.
  const [covered, setCovered] = useState(false);
  useEffect(
    () =>
      navigationRef.addListener('state', () => {
        const root = navigationRef.getRootState();
        setCovered(root ? root.routes[root.index]?.name !== 'Tabs' : false);
      }),
    [],
  );
  const progress = usePlayerProgress(1000, player.track !== null && !covered);
  const liked = useLikedIds();
  const { accent } = useTheme();
  const track = player.track;
  const bg = useArtworkColor(track?.artworkUrl);

  if (!track) return null;

  const ratio = progress.durationMs ? Math.min(1, progress.positionMs / progress.durationMs) : 0;
  const isLiked = liked.has(track.id);
  const buffering = player.state === 'buffering' && player.playWhenReady;

  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.wrap}>
      <Pressable
        onPress={() => navigation.navigate('Player')}
        style={[styles.bar, { backgroundColor: bg }]}
        accessibilityRole="button"
        accessibilityLabel="Open player"
      >
        <Artwork uri={track.artworkUrl} size={44} radius={4} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
          {buffering ? (
            <View style={styles.loading}>
              <ActivityIndicator size={12} color={accent} />
              <Text style={[styles.artist, styles.loadingText]}>Loading</Text>
            </View>
          ) : (
            <Text style={styles.artist} numberOfLines={1}>
              {track.artist}
            </Text>
          )}
        </View>
        <IconButton
          name={isLiked ? 'heart' : 'heart-outline'}
          color={isLiked ? accent : palette.text}
          size={24}
          onPress={() => setLiked(track, !isLiked).catch(() => undefined)}
          style={styles.action}
        />
        <Pressable onPress={() => togglePlay(player.playWhenReady)} hitSlop={12} style={styles.action}>
          <Ionicons name={player.playWhenReady ? 'pause' : 'play'} size={28} color={palette.text} />
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: accent }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingBottom: 4 },
  bar: {
    height: MINI_PLAYER_HEIGHT,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 12,
    overflow: 'hidden',
  },
  text: { flex: 1, marginLeft: 10, marginRight: 8 },
  title: { color: palette.text, fontSize: 14, fontWeight: '700' },
  artist: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 1 },
  loading: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  loadingText: { marginTop: 0, marginLeft: 6 },
  action: { marginLeft: 14 },
  progressTrack: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: palette.text },
});
