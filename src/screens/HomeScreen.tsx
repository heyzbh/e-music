import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Artwork } from '../components/Artwork';
import { IconButton } from '../components/IconButton';
import { PlayingBars } from '../components/PlayingBars';
import { Shelf, type CardItem } from '../components/Shelf';
import { openTrackSheet } from '../components/TrackSheet';
import { useRecentItems, type RecentItem } from '../db/collections';
import { useLikedTracks, useMostPlayed, useTopArtists } from '../db/library';
import { useFeed } from '../feed/recommend';
import type { HomeStackParams } from '../navigation/types';
import { playTracks } from '../playback/actions';
import { usePlayer } from '../playback/hooks';
import type { Track } from '../sources/types';
import { palette, radius, withAlpha } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { greeting } from '../utils/text';

type Nav = NativeStackNavigationProp<HomeStackParams>;

function trackCards(tracks: Track[]): CardItem[] {
  return tracks.map((t, i) => ({
    key: t.id,
    title: t.title,
    subtitle: t.artist,
    artworkUrl: t.artworkUrl ?? null,
    onPress: () => playTracks(tracks, i),
    onLongPress: () => openTrackSheet(t),
  }));
}

function recentTitle(item: RecentItem): string {
  return item.kind === 'track' ? item.track.title : item.context.title;
}

function recentArtwork(item: RecentItem): string | null {
  return item.kind === 'track' ? item.track.artworkUrl ?? null : item.context.artworkUrl;
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { accent } = useTheme();
  const player = usePlayer();
  const recent = useRecentItems(20);
  const most = useMostPlayed(20);
  const liked = useLikedTracks();
  const artists = useTopArtists(10);
  const { shelves, loading } = useFeed();

  // Single songs in history play as a little queue of their own.
  const recentTracks = recent.flatMap((r) => (r.kind === 'track' ? [r.track] : []));

  const openRecent = (item: RecentItem) => {
    if (item.kind === 'track') {
      playTracks(recentTracks, recentTracks.indexOf(item.track));
      return;
    }
    const c = item.context;
    if (c.kind === 'album') navigation.navigate('Album', { id: c.ref, name: c.title, artist: c.subtitle, artworkUrl: c.artworkUrl });
    else if (c.kind === 'playlist') navigation.navigate('Playlist', { id: Number(c.ref) });
    else if (c.kind === 'liked') navigation.navigate('Liked');
    else navigation.navigate('Artist', { name: c.ref, artworkUrl: c.artworkUrl });
  };

  const recentCards: CardItem[] = recent.map((r) => ({
    key: r.key,
    title: recentTitle(r),
    subtitle: r.kind === 'track' ? r.track.artist : r.context.subtitle,
    artworkUrl: recentArtwork(r),
    round: r.kind === 'context' && r.context.kind === 'artist',
    onPress: () => openRecent(r),
    onLongPress: r.kind === 'track' ? () => openTrackSheet(r.track) : undefined,
  }));

  const isNowPlaying = (r: RecentItem) =>
    r.kind === 'track' ? player.trackId === r.track.id : player.track?.context === r.key;

  // Liked Songs has its own tile, so leave it out of the rest.
  const quick = recent.filter((r) => r.key !== 'liked' || liked.length === 0).slice(0, liked.length > 0 ? 5 : 6);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <LinearGradient colors={[withAlpha(accent, 0.28), palette.bg]} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <IconButton name="settings-outline" onPress={() => navigation.navigate('Settings')} accessibilityLabel="Settings" />
        </View>

        {quick.length > 0 || liked.length > 0 ? (
          <View style={styles.grid}>
            {liked.length > 0 && (
              <Pressable style={styles.tile} onPress={() => navigation.navigate('Liked')}>
                <LinearGradient colors={['#4a2fd6', '#8fb4e8']} style={styles.tileArt}>
                  <Ionicons name="heart" size={22} color="#fff" />
                </LinearGradient>
                <Text style={styles.tileText} numberOfLines={2}>
                  Liked Songs
                </Text>
              </Pressable>
            )}
            {quick.map((r) => (
              <Pressable
                key={r.key}
                style={styles.tile}
                onPress={() => openRecent(r)}
                onLongPress={r.kind === 'track' ? () => openTrackSheet(r.track) : undefined}
              >
                <Artwork uri={recentArtwork(r)} size={56} radius={0} />
                <Text style={styles.tileText} numberOfLines={2}>
                  {recentTitle(r)}
                </Text>
                {isNowPlaying(r) && <PlayingBars color={accent} active={player.isPlaying} />}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Welcome to E Music</Text>
            <Text style={styles.welcomeText}>
              Search for any artist and start listening. Your home feed learns from what you play.
            </Text>
          </View>
        )}
      </LinearGradient>

      {shelves
        .filter((s) => s.key === 'mix')
        .map((s) => (
          <Shelf key={s.key} title={s.title} items={trackCards(s.tracks)} />
        ))}
      <Shelf title="Recently played" items={recentCards} />
      <Shelf
        title="Your top artists"
        items={artists.map((a) => ({
          key: a.name,
          title: a.name,
          artworkUrl: a.artworkUrl,
          round: true,
          onPress: () => navigation.navigate('Artist', { name: a.name, artworkUrl: a.artworkUrl }),
        }))}
      />
      <Shelf title="On repeat" items={trackCards(most)} />
      {shelves
        .filter((s) => s.key !== 'mix')
        .map((s) => (
          <Shelf
            key={s.key}
            title={s.title}
            items={trackCards(s.tracks)}
            action={s.artist ? 'Artist' : undefined}
            onAction={s.artist ? () => navigation.navigate('Artist', { name: s.artist ?? '', artworkUrl: null }) : undefined}
          />
        ))}
      {loading && shelves.length === 0 && <ActivityIndicator color={accent} style={styles.loader} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingBottom: 24 },
  hero: { paddingHorizontal: 16, paddingBottom: 24, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  greeting: { color: palette.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  tile: {
    width: '49%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.sm,
    overflow: 'hidden',
    paddingRight: 6,
  },
  tileArt: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1, color: palette.text, fontSize: 13, fontWeight: '700', marginHorizontal: 8 },
  welcome: { paddingVertical: 12 },
  welcomeTitle: { color: palette.text, fontSize: 20, fontWeight: '700' },
  welcomeText: { color: palette.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 },
  loader: { marginTop: 32 },
});
