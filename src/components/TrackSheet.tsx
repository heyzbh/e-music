import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setLiked, useLikedIds } from '../db/library';
import { addToPlaylist, createPlaylist, usePlaylists } from '../db/playlists';
import { openDetail } from '../navigation/types';
import { addToQueue, playNext } from '../playback/actions';
import { SOURCE_LABEL, type Track } from '../sources/types';
import { palette, radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Artwork } from './Artwork';
import { prompt } from './Prompt';
import { showToast } from './Toast';

interface SheetRequest {
  track: Track;
  /** Extra action shown when opened from a playlist. */
  onRemove?: () => void;
}

let open: ((req: SheetRequest) => void) | null = null;

export function openTrackSheet(track: Track, onRemove?: () => void): void {
  open?.({ track, onRemove });
}

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color?: string };

/** Bottom sheet with everything you can do with a track. Mount <TrackSheetHost/> once. */
export function TrackSheetHost() {
  const insets = useSafeAreaInsets();
  const { accent } = useTheme();
  const liked = useLikedIds();
  const playlists = usePlaylists();
  const [req, setReq] = useState<SheetRequest | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    open = (r) => {
      setPicking(false);
      setReq(r);
    };
    return () => {
      open = null;
    };
  }, []);

  const close = () => setReq(null);
  const track = req?.track;
  const isLiked = track ? liked.has(track.id) : false;

  const act = (fn: () => void) => () => {
    close();
    fn();
  };

  const rows: Row[] = track
    ? [
        {
          icon: isLiked ? 'heart' : 'heart-outline',
          label: isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs',
          color: isLiked ? accent : undefined,
          onPress: act(() => {
            setLiked(track, !isLiked).catch(() => undefined);
            showToast(isLiked ? 'Removed from Liked Songs' : 'Added to Liked Songs');
          }),
        },
        { icon: 'add-circle-outline', label: 'Add to playlist', onPress: () => setPicking(true) },
        { icon: 'play-forward-outline', label: 'Play next', onPress: act(() => playNext(track)) },
        { icon: 'list-outline', label: 'Add to queue', onPress: act(() => addToQueue(track)) },
        ...(track.artist
          ? [
              {
                icon: 'person-outline' as const,
                label: `Go to ${track.artist}`,
                onPress: act(() => openDetail('Artist', { name: track.artist, artworkUrl: null })),
              },
            ]
          : []),
        ...(req?.onRemove
          ? [{ icon: 'remove-circle-outline' as const, label: 'Remove from this playlist', onPress: act(req.onRemove) }]
          : []),
      ]
    : [];

  const addTo = (id: number, name: string) =>
    act(() => {
      if (!track) return;
      addToPlaylist(id, [track]).catch(() => undefined);
      showToast(`Added to ${name}`);
    });

  const newPlaylist = act(() => {
    if (!track) return;
    // Let the sheet finish closing before the dialog opens.
    setTimeout(() => prompt({
      title: 'Give your playlist a name',
      confirmLabel: 'Create',
      onSubmit: (name) => {
        createPlaylist(name, [track]).catch(() => undefined);
        showToast(`Added to ${name}`);
      },
    }), 250);
  });

  return (
    <Modal visible={req !== null} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        {track && (
          <View style={styles.header}>
            <Artwork uri={track.artworkUrl} size={52} />
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {track.artist} · {SOURCE_LABEL[track.source]}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.divider} />
        <ScrollView style={styles.list} bounces={false}>
          {picking ? (
            <>
              <SheetRow icon="add" label="New playlist" onPress={newPlaylist} color={accent} />
              {playlists.map((p) => (
                <SheetRow key={p.id} icon="musical-notes-outline" label={p.name} onPress={addTo(p.id, p.name)} />
              ))}
            </>
          ) : (
            rows.map((r) => <SheetRow key={r.label} {...r} />)
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SheetRow({ icon, label, onPress, color }: Row) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: palette.highlight }]}
    >
      <Ionicons name={icon} size={24} color={color ?? palette.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: palette.overlay },
  sheet: {
    backgroundColor: palette.elevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.textTertiary,
    marginTop: 8,
    marginBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  headerText: { flex: 1, marginLeft: 12 },
  title: { color: palette.text, fontSize: 16, fontWeight: '700' },
  subtitle: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: palette.border, marginTop: 8 },
  list: { paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  rowLabel: { color: palette.text, fontSize: 16, marginLeft: 18 },
});
