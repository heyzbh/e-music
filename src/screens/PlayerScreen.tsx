import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import EPlayer from '../../modules/e-player';
import { Artwork } from '../components/Artwork';
import { IconButton } from '../components/IconButton';
import { SeekBar } from '../components/SeekBar';
import { openTrackSheet } from '../components/TrackSheet';
import { useArtworkColor } from '../components/useArtworkColor';
import { setLiked, useLikedIds } from '../db/library';
import { openDetail, type RootParams } from '../navigation/types';
import { next, previous, seekTo, togglePlay } from '../playback/actions';
import { usePlayer, usePlayerProgress } from '../playback/hooks';
import { setSleepTimer, useSleepTimer } from '../playback/sleep';
import { SOURCE_LABEL } from '../sources/types';
import { palette, radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type Nav = NativeStackNavigationProp<RootParams>;

const SLEEP_OPTIONS: { label: string; value: number | 'endOfTrack' | 'off' }[] = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '1 hour', value: 60 },
  { label: 'End of track', value: 'endOfTrack' },
  { label: 'Turn off timer', value: 'off' },
];

export default function PlayerScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { accent } = useTheme();
  const player = usePlayer();
  const progress = usePlayerProgress(400);
  const liked = useLikedIds();
  const sleep = useSleepTimer();
  const [sleepOpen, setSleepOpen] = useState(false);
  const track = player.track;
  const color = useArtworkColor(track?.artworkUrl);

  // Close when the queue is cleared.
  useEffect(() => {
    if (!track && navigation.canGoBack()) navigation.goBack();
  }, [track, navigation]);

  // Swipe the artwork sideways to skip.
  const artSize = width - 48;
  const offset = useSharedValue(0);
  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      offset.value = e.translationX;
    })
    .onEnd((e) => {
      const threshold = artSize * 0.28;
      if (e.translationX < -threshold || e.velocityX < -800) {
        offset.value = withTiming(-artSize, { duration: 160 }, () => {
          offset.value = 0;
        });
        scheduleOnRN(next);
      } else if (e.translationX > threshold || e.velocityX > 800) {
        offset.value = withTiming(artSize, { duration: 160 }, () => {
          offset.value = 0;
        });
        scheduleOnRN(previous);
      } else {
        offset.value = withSpring(0);
      }
    });
  const artStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { scale: player.playWhenReady ? 1 : 0.9 }],
    opacity: 1 - Math.min(0.5, Math.abs(offset.value) / artSize),
  }));

  if (!track) return <View style={styles.root} />;

  const isLiked = liked.has(track.id);
  const buffering = player.state === 'buffering' && player.playWhenReady;
  const cycleRepeat = () => {
    const nextMode = player.repeatMode === 'off' ? 'all' : player.repeatMode === 'all' ? 'one' : 'off';
    EPlayer.setRepeatMode(nextMode).catch(() => undefined);
  };
  const sleepLabel =
    sleep.kind === 'at'
      ? `${Math.max(1, Math.round((sleep.endsAt - Date.now()) / 60_000))} min`
      : sleep.kind === 'endOfTrack'
        ? 'End of track'
        : null;

  return (
    <LinearGradient colors={[color, '#121214']} locations={[0, 0.85]} style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <IconButton name="chevron-down" size={30} onPress={() => navigation.goBack()} accessibilityLabel="Close player" />
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>PLAYING FROM</Text>
          <Text style={styles.headerSource} numberOfLines={1}>
            {SOURCE_LABEL[track.source]}
          </Text>
        </View>
        <IconButton name="ellipsis-vertical" size={22} onPress={() => openTrackSheet(track)} accessibilityLabel="More" />
      </View>

      <View style={styles.artArea}>
        <GestureDetector gesture={swipe}>
          <Animated.View style={[styles.artShadow, artStyle]}>
            <Artwork uri={track.artworkUrl} size={artSize} radius={8} />
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.title} numberOfLines={1}>
              {track.title}
            </Text>
            <Pressable onPress={() => track.artist && openDetail('Artist', { name: track.artist, artworkUrl: null })}>
              <Text style={styles.artist} numberOfLines={1}>
                {track.artist || 'Unknown artist'}
              </Text>
            </Pressable>
          </View>
          <IconButton
            name={isLiked ? 'heart' : 'heart-outline'}
            size={28}
            color={isLiked ? accent : palette.text}
            onPress={() => setLiked(track, !isLiked).catch(() => undefined)}
            accessibilityLabel={isLiked ? 'Unlike' : 'Like'}
          />
        </View>

        <SeekBar
          positionMs={progress.positionMs}
          bufferedMs={progress.bufferedMs}
          durationMs={progress.durationMs ?? track.durationMs ?? null}
          onSeek={seekTo}
          color={palette.text}
        />

        <View style={styles.controls}>
          <IconButton
            name="shuffle"
            size={26}
            color={player.shuffle ? accent : palette.text}
            onPress={() => EPlayer.setShuffle(!player.shuffle).catch(() => undefined)}
            accessibilityLabel="Shuffle"
          />
          <IconButton name="play-skip-back" size={34} onPress={previous} accessibilityLabel="Previous" />
          <Pressable
            onPress={() => togglePlay(player.playWhenReady)}
            accessibilityLabel={player.playWhenReady ? 'Pause' : 'Play'}
            style={({ pressed }) => [styles.playButton, { transform: [{ scale: pressed ? 0.93 : 1 }] }]}
          >
            {buffering ? (
              <ActivityIndicator size="large" color="#000" />
            ) : (
              <Ionicons name={player.playWhenReady ? 'pause' : 'play'} size={34} color="#000" style={!player.playWhenReady && styles.playIcon} />
            )}
          </Pressable>
          <IconButton name="play-skip-forward" size={34} onPress={next} accessibilityLabel="Next" />
          <View>
            <IconButton
              name="repeat"
              size={26}
              color={player.repeatMode !== 'off' ? accent : palette.text}
              onPress={cycleRepeat}
              accessibilityLabel={`Repeat ${player.repeatMode}`}
            />
            {player.repeatMode === 'one' && <Text style={[styles.repeatOne, { color: accent }]}>1</Text>}
          </View>
        </View>

        {player.error && (
          <Text style={styles.error} numberOfLines={2}>
            Couldn't play this track ({player.error.code}). Skipping usually helps.
          </Text>
        )}

        <View style={styles.footer}>
          <Pressable style={styles.footerButton} onPress={() => setSleepOpen(true)} hitSlop={8}>
            <Ionicons name="moon-outline" size={20} color={sleepLabel ? accent : palette.textSecondary} />
            {sleepLabel && <Text style={[styles.footerText, { color: accent }]}>{sleepLabel}</Text>}
          </Pressable>
          <View style={styles.attribution}>
            <Text style={styles.attributionText} numberOfLines={1}>
              {track.source === 'audius' ? `${track.artist} on Audius` : track.source === 'local' ? 'Local file' : 'YouTube Music'}
            </Text>
          </View>
          <IconButton name="list" size={24} color={palette.textSecondary} onPress={() => navigation.navigate('Queue')} accessibilityLabel="Queue" />
        </View>
      </View>

      <Modal visible={sleepOpen} transparent animationType="fade" onRequestClose={() => setSleepOpen(false)} statusBarTranslucent>
        <Pressable style={styles.sleepBackdrop} onPress={() => setSleepOpen(false)}>
          <View style={styles.sleepCard}>
            <Text style={styles.sleepTitle}>Sleep timer</Text>
            {SLEEP_OPTIONS.map((o) => (
              <Pressable
                key={o.label}
                style={({ pressed }) => [styles.sleepRow, pressed && { backgroundColor: palette.highlight }]}
                onPress={() => {
                  setSleepOpen(false);
                  setSleepTimer(o.value).catch(() => undefined);
                }}
              >
                <Text style={[styles.sleepText, o.value === 'off' && { color: palette.textSecondary }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: -8 },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  headerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  headerSource: { color: palette.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  artArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  artShadow: { elevation: 24, shadowColor: '#000', borderRadius: 8 },
  body: {},
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  titleText: { flex: 1, marginRight: 16 },
  title: { color: palette.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.3 },
  artist: { color: 'rgba(255,255,255,0.72)', fontSize: 16, marginTop: 4 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  playButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  playIcon: { marginLeft: 4 },
  repeatOne: { position: 'absolute', right: -6, top: -6, fontSize: 10, fontWeight: '900' },
  error: { color: palette.danger, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  footerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 60 },
  footerText: { fontSize: 12, fontWeight: '700' },
  attribution: { flex: 1, alignItems: 'center' },
  attributionText: { color: palette.textTertiary, fontSize: 12 },
  sleepBackdrop: { flex: 1, backgroundColor: palette.overlay, justifyContent: 'flex-end' },
  sleepCard: { backgroundColor: palette.elevated, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingVertical: 12, paddingBottom: 32 },
  sleepTitle: { color: palette.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginVertical: 12 },
  sleepRow: { paddingHorizontal: 24, paddingVertical: 15 },
  sleepText: { color: palette.text, fontSize: 16 },
});
