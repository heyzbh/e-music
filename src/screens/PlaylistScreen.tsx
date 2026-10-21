import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { Artwork } from '../components/Artwork';
import { CollectionHeader } from '../components/CollectionHeader';
import { IconButton } from '../components/IconButton';
import { PlaylistCover } from '../components/PlaylistCover';
import { prompt } from '../components/Prompt';
import { EmptyState } from '../components/Shelf';
import { useTrackRenderer } from '../components/TrackList';
import { playlistContext } from '../db/collections';
import { deletePlaylist, renamePlaylist, setPlaylistOrder, usePlaylist } from '../db/playlists';
import type { DetailParams } from '../navigation/types';
import { playTracks } from '../playback/actions';
import type { Track } from '../sources/types';
import { palette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { formatDuration, pluralize } from '../utils/text';

export default function PlaylistScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<DetailParams, 'Playlist'>>();
  const { accent } = useTheme();
  const playlist = usePlaylist(params.id);
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<Track[]>([]);

  const tracks = playlist?.tracks ?? [];
  useEffect(() => setOrder(tracks), [tracks]);

  const removeAt = useCallback(
    (index: number) => {
      setPlaylistOrder(params.id, tracks.filter((_, i) => i !== index).map((t) => t.id)).catch(() => undefined);
    },
    [params.id, tracks],
  );
  const covers = [...new Set(tracks.map((t) => t.artworkUrl).filter((u): u is string => !!u))].slice(0, 4);
  const context = useMemo(() => playlistContext(params.id, playlist?.name ?? 'Playlist', covers[0] ?? null), [params.id, playlist?.name, covers[0]]);
  const renderItem = useTrackRenderer(tracks, { onRemove: removeAt, context });
  const totalMs = tracks.reduce((s, t) => s + (t.durationMs ?? 0), 0);

  const rename = () =>
    prompt({
      title: 'Rename playlist',
      initial: playlist?.name,
      onSubmit: (name) => renamePlaylist(params.id, name).catch(() => undefined),
    });

  const remove = () =>
    Alert.alert('Delete playlist?', `"${playlist?.name}" will be deleted. Songs stay in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePlaylist(params.id).catch(() => undefined);
          navigation.goBack();
        },
      },
    ]);

  const header = (
    <CollectionHeader
      title={playlist?.name ?? ''}
      meta={`Playlist · ${pluralize(tracks.length, 'song', 'songs')}${totalMs ? ` · ${formatDuration(totalMs)}` : ''}`}
      artworkUrl={covers[0] ?? null}
      cover={<PlaylistCover covers={covers} size={220} />}
      onBack={() => navigation.goBack()}
      onPlay={tracks.length > 0 ? () => playTracks(tracks, 0, false, context) : undefined}
      onShuffle={tracks.length > 0 ? () => playTracks(tracks, 0, true, context) : undefined}
      actions={
        <>
          <IconButton name="create-outline" size={24} color={palette.textSecondary} onPress={rename} accessibilityLabel="Rename" />
          <IconButton
            name={editing ? 'checkmark-done' : 'swap-vertical'}
            size={24}
            color={editing ? accent : palette.textSecondary}
            onPress={() => setEditing((e) => !e)}
            accessibilityLabel="Reorder"
          />
          <IconButton name="trash-outline" size={22} color={palette.textSecondary} onPress={remove} accessibilityLabel="Delete" />
        </>
      }
    />
  );

  const renderEditable = ({ item, drag, isActive }: RenderItemParams<Track>) => (
    <ScaleDecorator activeScale={1.03}>
      <Pressable onLongPress={drag} disabled={isActive} style={[styles.editRow, isActive && styles.editActive]}>
        <Artwork uri={item.artworkUrl} size={44} radius={4} />
        <View style={styles.editText}>
          <Text style={styles.editTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.editSub} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        <Pressable onPressIn={drag} hitSlop={10} style={styles.handle}>
          <Ionicons name="reorder-three" size={26} color={palette.textSecondary} />
        </Pressable>
      </Pressable>
    </ScaleDecorator>
  );

  const empty = playlist ? (
    <EmptyState
      icon={<Ionicons name="musical-notes-outline" size={44} color={palette.textTertiary} />}
      title="Let's find something for your playlist"
      message="Use ⋮ on any song and choose Add to playlist."
    />
  ) : undefined;

  if (editing) {
    return (
      <DraggableFlatList
        style={styles.root}
        data={order}
        keyExtractor={(t, i) => `${t.id}#${i}`}
        renderItem={renderEditable}
        onDragEnd={({ data }) => {
          setOrder(data);
          setPlaylistOrder(params.id, data.map((t) => t.id)).catch(() => undefined);
        }}
        activationDistance={8}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={<View style={styles.footer} />}
      />
    );
  }

  return (
    <FlatList
      style={styles.root}
      data={tracks}
      keyExtractor={(t, i) => `${t.id}#${i}`}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={<View style={styles.footer} />}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  footer: { height: 24 },
  editRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, height: 62, backgroundColor: palette.bg },
  editActive: { backgroundColor: palette.elevated },
  editText: { flex: 1, marginHorizontal: 12 },
  editTitle: { color: palette.text, fontSize: 15 },
  editSub: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  handle: { paddingHorizontal: 8, paddingVertical: 12 },
});
