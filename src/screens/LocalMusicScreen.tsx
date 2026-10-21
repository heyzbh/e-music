import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../components/IconButton';
import { EmptyState } from '../components/Shelf';
import { useTrackRenderer } from '../components/TrackList';
import { TRACK_ROW_HEIGHT } from '../components/TrackRow';
import { playTracks } from '../playback/actions';
import { loadLocalLibrary, searchLocal, useLocalLibrary } from '../sources/local';
import { palette, radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { pluralize } from '../utils/text';

export default function LocalMusicScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { accent } = useTheme();
  const library = useLocalLibrary();
  const [query, setQuery] = useState('');

  const tracks = useMemo(
    () => (query.trim() ? searchLocal(query, 1000) : library.tracks),
    [query, library.tracks],
  );
  const renderItem = useTrackRenderer(tracks, { showDuration: true });

  const needsPermission = library.status === 'unknown' || library.status === 'denied';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton name="chevron-back" size={28} onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        <Text style={styles.heading}>On this phone</Text>
        <IconButton name="refresh" size={22} onPress={() => loadLocalLibrary(true).catch(() => undefined)} accessibilityLabel="Rescan" />
      </View>

      {needsPermission ? (
        <EmptyState
          icon={<Ionicons name="folder-open-outline" size={48} color={palette.textTertiary} />}
          title="Play music stored on your phone"
          message="Allow access to audio files to see your MP3, M4A, FLAC and OGG files here."
        >
          <Pressable style={[styles.allow, { backgroundColor: accent }]} onPress={() => loadLocalLibrary(true).catch(() => undefined)}>
            <Text style={styles.allowText}>Allow access</Text>
          </Pressable>
        </EmptyState>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          getItemLayout={(_, index) => ({ length: TRACK_ROW_HEIGHT, offset: TRACK_ROW_HEIGHT * index, index })}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.search}>
                <Ionicons name="search" size={18} color={palette.textSecondary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Find in local files"
                  placeholderTextColor={palette.textTertiary}
                  selectionColor={accent}
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.summary}>
                <Text style={styles.count}>{pluralize(tracks.length, 'song', 'songs')}</Text>
                {tracks.length > 0 && (
                  <Pressable style={styles.shuffle} onPress={() => playTracks(tracks, 0, true)}>
                    <Ionicons name="shuffle" size={18} color="#000" />
                    <Text style={styles.shuffleText}>Shuffle</Text>
                  </Pressable>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={
            library.status === 'loading' ? (
              <ActivityIndicator color={accent} style={styles.loader} />
            ) : (
              <Text style={styles.empty}>{query ? 'No matching files' : 'No music files found on this phone'}</Text>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 56 },
  heading: { flex: 1, color: palette.text, fontSize: 18, fontWeight: '700', marginLeft: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.elevated,
    borderRadius: radius.sm,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, color: palette.text, marginLeft: 8, fontSize: 14, paddingVertical: 0 },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  count: { color: palette.textSecondary, fontSize: 13 },
  shuffle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  shuffleText: { color: '#000', fontWeight: '700', fontSize: 13 },
  allow: { marginTop: 20, borderRadius: radius.pill, paddingHorizontal: 28, paddingVertical: 12 },
  allowText: { color: '#000', fontWeight: '700', fontSize: 15 },
  loader: { marginTop: 32 },
  empty: { color: palette.textSecondary, textAlign: 'center', marginTop: 32 },
});
