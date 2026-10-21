import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Artwork } from '../components/Artwork';
import { IconButton } from '../components/IconButton';
import { LikedCover, PlaylistCover } from '../components/PlaylistCover';
import { prompt } from '../components/Prompt';
import { useSavedAlbums } from '../db/collections';
import { useLikedTracks, useTopArtists } from '../db/library';
import { createPlaylist, usePlaylists } from '../db/playlists';
import type { LibraryStackParams } from '../navigation/types';
import { useLocalLibrary } from '../sources/local';
import { palette, radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { pluralize } from '../utils/text';

type Nav = NativeStackNavigationProp<LibraryStackParams>;
type Filter = 'all' | 'playlists' | 'albums' | 'artists';

interface Item {
  key: string;
  title: string;
  subtitle: string;
  cover: ReactNode;
  onPress: () => void;
}

export default function LibraryScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { accent } = useTheme();
  const playlists = usePlaylists();
  const liked = useLikedTracks();
  const artists = useTopArtists(30);
  const local = useLocalLibrary();
  const albums = useSavedAlbums();
  const [filter, setFilter] = useState<Filter>('all');

  const newPlaylist = () =>
    prompt({
      title: 'Give your playlist a name',
      confirmLabel: 'Create',
      onSubmit: (name) => {
        createPlaylist(name)
          .then((id) => navigation.navigate('Playlist', { id }))
          .catch(() => undefined);
      },
    });

  const items: Item[] = [];
  if (filter === 'all' || filter === 'playlists') {
    items.push({
      key: 'liked',
      title: 'Liked Songs',
      subtitle: `Playlist · ${pluralize(liked.length, 'song', 'songs')}`,
      cover: <LikedCover size={64} />,
      onPress: () => navigation.navigate('Liked'),
    });
    items.push({
      key: 'local',
      title: 'On this phone',
      subtitle: local.status === 'ready' ? `Local files · ${pluralize(local.tracks.length, 'song', 'songs')}` : 'Local files',
      cover: (
        <View style={[styles.iconCover, { backgroundColor: palette.elevated }]}>
          <Ionicons name="phone-portrait-outline" size={28} color={accent} />
        </View>
      ),
      onPress: () => navigation.navigate('LocalMusic'),
    });
    playlists.forEach((p) =>
      items.push({
        key: `pl:${p.id}`,
        title: p.name,
        subtitle: `Playlist · ${pluralize(p.trackCount, 'song', 'songs')}`,
        cover: <PlaylistCover covers={p.covers} size={64} />,
        onPress: () => navigation.navigate('Playlist', { id: p.id }),
      }),
    );
  }
  if (filter === 'all' || filter === 'albums') {
    albums.forEach((a) =>
      items.push({
        key: `al:${a.id}`,
        title: a.name,
        subtitle: `Album · ${a.artist}`,
        cover: <Artwork uri={a.artworkUrl} size={64} radius={4} />,
        onPress: () => navigation.navigate('Album', { id: a.id, name: a.name, artist: a.artist, artworkUrl: a.artworkUrl }),
      }),
    );
  }
  if (filter === 'all' || filter === 'artists') {
    artists.forEach((a) =>
      items.push({
        key: `ar:${a.name}`,
        title: a.name,
        subtitle: 'Artist',
        cover: <Artwork uri={a.artworkUrl} size={64} round />,
        onPress: () => navigation.navigate('Artist', { name: a.name, artworkUrl: a.artworkUrl }),
      }),
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.heading}>Your Library</Text>
        <IconButton name="add" size={30} onPress={newPlaylist} accessibilityLabel="New playlist" />
        <IconButton name="settings-outline" size={24} onPress={() => navigation.navigate('Settings')} style={styles.gear} accessibilityLabel="Settings" />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(['playlists', 'albums', 'artists'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(filter === f ? 'all' : f)}
              style={[styles.chip, filter === f && { backgroundColor: accent }]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'playlists' ? 'Playlists' : f === 'albums' ? 'Albums' : 'Artists'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={item.onPress}
            android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {item.cover}
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          filter === 'all' || filter === 'playlists' ? (
            <Pressable style={styles.row} onPress={newPlaylist}>
              <View style={[styles.iconCover, styles.addCover]}>
                <Ionicons name="add" size={32} color={palette.textSecondary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Create playlist</Text>
              </View>
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  heading: { flex: 1, color: palette.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  gear: { marginLeft: 16 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { backgroundColor: palette.elevated, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  chipText: { color: palette.text, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  list: { paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rowText: { flex: 1, marginLeft: 14 },
  rowTitle: { color: palette.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: palette.textSecondary, fontSize: 13, marginTop: 3 },
  iconCover: { width: 64, height: 64, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  addCover: { backgroundColor: palette.surface },
});
