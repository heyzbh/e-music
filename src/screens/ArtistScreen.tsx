import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CollectionHeader } from '../components/CollectionHeader';
import { SectionTitle, Shelf } from '../components/Shelf';
import { TrackRow } from '../components/TrackRow';
import { openTrackSheet } from '../components/TrackSheet';
import { artistContext } from '../db/collections';
import { useLikedIds } from '../db/library';
import type { DetailParams } from '../navigation/types';
import { playTracks } from '../playback/actions';
import { usePlayer } from '../playback/hooks';
import { getArtistPage, type ArtistPage } from '../sources/search';
import { palette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

export default function ArtistScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DetailParams>>();
  const { params } = useRoute<RouteProp<DetailParams, 'Artist'>>();
  const { accent } = useTheme();
  const player = usePlayer();
  const liked = useLikedIds();
  const [page, setPage] = useState<ArtistPage | null>(null);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getArtistPage(params.name, params.artworkUrl)
      .then((p) => !cancelled && setPage(p))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [params.name, params.artworkUrl]);

  const songs = page?.songs ?? [];
  const visible = showAll ? songs : songs.slice(0, 5);
  const artwork = params.artworkUrl ?? page?.albums[0]?.artworkUrl ?? songs[0]?.artworkUrl ?? null;
  const context = artistContext(params.name, artwork);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <CollectionHeader
        title={params.name}
        meta="Artist"
        artworkUrl={artwork}
        round
        onBack={() => navigation.goBack()}
        onPlay={songs.length > 0 ? () => playTracks(songs, 0, false, context) : undefined}
        onShuffle={songs.length > 0 ? () => playTracks(songs, 0, true, context) : undefined}
      />
      {!page && !error && <ActivityIndicator color={accent} style={styles.loader} />}
      {error && <Text style={styles.error}>Couldn't load this artist. Check your connection.</Text>}
      {songs.length > 0 && (
        <View style={styles.section}>
          <SectionTitle title="Popular" action={songs.length > 5 ? (showAll ? 'Show less' : 'See more') : undefined} onAction={() => setShowAll((v) => !v)} />
          {visible.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              number={i + 1}
              active={player.trackId === t.id}
              playing={player.isPlaying}
              liked={liked.has(t.id)}
              accent={accent}
              showDuration
              onPress={() => playTracks(songs, i, false, context)}
              onMore={() => openTrackSheet(t)}
            />
          ))}
        </View>
      )}
      {page && (
        <Shelf
          title="Albums and singles"
          items={page.albums.map((a) => ({
            key: a.id,
            title: a.name,
            subtitle: a.artist,
            artworkUrl: a.artworkUrl,
            onPress: () => navigation.push('Album', { id: a.id, name: a.name, artist: a.artist, artworkUrl: a.artworkUrl }),
          }))}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingBottom: 24 },
  section: { marginTop: 8, marginBottom: 24 },
  loader: { marginTop: 32 },
  error: { color: palette.textSecondary, textAlign: 'center', marginTop: 32 },
});
