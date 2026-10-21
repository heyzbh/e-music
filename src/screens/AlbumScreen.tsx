import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { CollectionHeader } from '../components/CollectionHeader';
import { IconButton } from '../components/IconButton';
import { showToast } from '../components/Toast';
import { useTrackRenderer } from '../components/TrackList';
import { TRACK_ROW_HEIGHT } from '../components/TrackRow';
import { albumContext, setAlbumSaved, useIsAlbumSaved } from '../db/collections';
import type { DetailParams } from '../navigation/types';
import { playTracks } from '../playback/actions';
import * as youtube from '../sources/youtube';
import type { AlbumDetail, AlbumRef } from '../sources/types';
import { palette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatDuration, pluralize } from '../utils/text';

export default function AlbumScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<DetailParams, 'Album'>>();
  const { accent } = useTheme();
  const saved = useIsAlbumSaved(params.id);
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    youtube
      .getAlbum(params.id)
      .then((a) => !cancelled && setAlbum(a))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const ref: AlbumRef = {
    kind: 'album',
    source: 'youtube',
    id: params.id,
    name: album?.name ?? params.name,
    artist: album?.artist ?? params.artist,
    artworkUrl: album?.artworkUrl ?? params.artworkUrl,
  };
  const context = useMemo(() => albumContext(ref), [ref.id, ref.name, ref.artist, ref.artworkUrl]);

  const tracks = album?.tracks ?? [];
  // Every row shows the album cover; it is one image, decoded once and reused from cache.
  const renderItem = useTrackRenderer(tracks, { showDuration: true, context });
  const totalMs = tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);

  const toggleSaved = () => {
    setAlbumSaved(ref, !saved).catch(() => undefined);
    showToast(saved ? 'Removed from Your Library' : 'Saved to Your Library');
  };

  return (
    <FlatList
      style={styles.root}
      data={tracks}
      keyExtractor={(t) => t.id}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({ length: TRACK_ROW_HEIGHT, offset: TRACK_ROW_HEIGHT * index, index })}
      ListHeaderComponent={
        <CollectionHeader
          title={ref.name}
          subtitle={ref.artist}
          meta={album ? `Album · ${pluralize(tracks.length, 'song', 'songs')} · ${formatDuration(totalMs)}` : 'Album'}
          artworkUrl={ref.artworkUrl}
          onBack={() => navigation.goBack()}
          onPlay={tracks.length > 0 ? () => playTracks(tracks, 0, false, context) : undefined}
          onShuffle={tracks.length > 0 ? () => playTracks(tracks, 0, true, context) : undefined}
          actions={
            <IconButton
              name={saved ? 'heart' : 'heart-outline'}
              size={28}
              color={saved ? accent : palette.textSecondary}
              onPress={toggleSaved}
              accessibilityLabel={saved ? 'Remove album from library' : 'Save album'}
            />
          }
        />
      }
      ListEmptyComponent={
        error ? (
          <Text style={styles.error}>Couldn't load this album. Check your connection.</Text>
        ) : (
          <ActivityIndicator color={accent} style={styles.loader} />
        )
      }
      ListFooterComponent={<View style={styles.footer} />}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  loader: { marginTop: 32 },
  error: { color: palette.textSecondary, textAlign: 'center', marginTop: 32 },
  footer: { height: 24 },
});
