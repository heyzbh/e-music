import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { CollectionHeader } from '../components/CollectionHeader';
import { LikedCover } from '../components/PlaylistCover';
import { EmptyState } from '../components/Shelf';
import { useTrackRenderer } from '../components/TrackList';
import { TRACK_ROW_HEIGHT } from '../components/TrackRow';
import { LIKED_CONTEXT } from '../db/collections';
import { useLikedTracks } from '../db/library';
import { useOffline } from '../offline/offline';
import { playTracks } from '../playback/actions';
import { palette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { pluralize } from '../utils/text';

export default function LikedScreen() {
  const navigation = useNavigation();
  const { accent } = useTheme();
  const tracks = useLikedTracks();
  const offline = useOffline();
  const renderItem = useTrackRenderer(tracks, { context: LIKED_CONTEXT });

  const streamable = tracks.filter((t) => t.source !== 'local');
  const saved = streamable.filter((t) => offline.downloaded.has(t.url)).length;

  return (
    <FlatList
      style={styles.root}
      data={tracks}
      keyExtractor={(t) => t.id}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({ length: TRACK_ROW_HEIGHT, offset: TRACK_ROW_HEIGHT * index, index })}
      ListHeaderComponent={
        <View>
          <CollectionHeader
            title="Liked Songs"
            meta={pluralize(tracks.length, 'song', 'songs')}
            artworkUrl={null}
            tint="#3b2a99"
            cover={<LikedCover size={220} />}
            onBack={() => navigation.goBack()}
            onPlay={tracks.length > 0 ? () => playTracks(tracks, 0, false, LIKED_CONTEXT) : undefined}
            onShuffle={tracks.length > 0 ? () => playTracks(tracks, 0, true, LIKED_CONTEXT) : undefined}
          />
          {streamable.length > 0 && (
            <View style={styles.offline}>
              {offline.pending > 0 ? (
                <ActivityIndicator size="small" color={accent} />
              ) : (
                <Ionicons
                  name={saved === streamable.length ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                  size={20}
                  color={saved === streamable.length ? accent : palette.textSecondary}
                />
              )}
              <Text style={styles.offlineText}>
                {offline.pending > 0
                  ? `Saving for offline… ${saved} of ${streamable.length}`
                  : saved === streamable.length
                    ? 'All liked songs are available offline'
                    : `${saved} of ${streamable.length} saved for offline`}
              </Text>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon={<Ionicons name="heart-outline" size={44} color={palette.textTertiary} />}
          title="Songs you like will appear here"
          message="Tap the heart on any song to save it. Liked songs are kept on your phone for offline listening."
        />
      }
      ListFooterComponent={<View style={styles.footer} />}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  offlineText: { color: palette.textSecondary, fontSize: 13 },
  footer: { height: 24 },
});
