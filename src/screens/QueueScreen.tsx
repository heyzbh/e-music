import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EPlayer from '../../modules/e-player';
import { Artwork } from '../components/Artwork';
import { IconButton } from '../components/IconButton';
import { PlayingBars } from '../components/PlayingBars';
import { usePlayer } from '../playback/hooks';
import type { Track } from '../sources/types';
import { palette } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface Row {
  key: string;
  index: number;
  track: Track;
}

export default function QueueScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { accent } = useTheme();
  const player = usePlayer();
  const [queue, setQueue] = useState<Track[]>([]);

  const refresh = useCallback(() => {
    EPlayer.getState()
      .then((s) => setQueue(s.queue))
      .catch(() => undefined);
  }, []);

  // Re-read whenever the native queue changes (length, current item, shuffle).
  useEffect(refresh, [refresh, player.queueLength, player.index, player.shuffle]);

  const current = player.index;
  const upNext: Row[] = queue
    .map((track, index) => ({ key: `${track.id}#${index}`, index, track }))
    .filter((r) => r.index > current);

  const onDragEnd = ({ from, to }: { from: number; to: number }) => {
    if (from === to) return;
    // Rows in "up next" are offset by the current index.
    const absFrom = current + 1 + from;
    const absTo = current + 1 + to;
    setQueue((q) => {
      const copy = [...q];
      const [moved] = copy.splice(absFrom, 1);
      copy.splice(absTo, 0, moved);
      return copy;
    });
    EPlayer.move(absFrom, absTo).catch(refresh);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Row>) => (
    <ScaleDecorator activeScale={1.03}>
      <Pressable
        onPress={() => EPlayer.skipTo(item.index, 0).catch(() => undefined)}
        onLongPress={drag}
        disabled={isActive}
        style={[styles.row, isActive && styles.rowActive]}
      >
        <Artwork uri={item.track.artworkUrl} size={44} radius={4} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {item.track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {item.track.artist}
          </Text>
        </View>
        <IconButton
          name="remove-circle-outline"
          size={22}
          color={palette.textTertiary}
          onPress={() => EPlayer.remove(item.index).catch(() => undefined)}
          accessibilityLabel="Remove from queue"
        />
        <Pressable onPressIn={drag} hitSlop={10} style={styles.handle}>
          <Ionicons name="reorder-three" size={26} color={palette.textSecondary} />
        </Pressable>
      </Pressable>
    </ScaleDecorator>
  );

  const nowPlaying = player.track;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton name="chevron-down" size={28} onPress={() => navigation.goBack()} accessibilityLabel="Close queue" />
        <Text style={styles.heading}>Queue</Text>
        <View style={styles.headerSpacer} />
      </View>
      <DraggableFlatList
        data={upNext}
        keyExtractor={(r) => r.key}
        renderItem={renderItem}
        onDragEnd={onDragEnd}
        activationDistance={12}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          nowPlaying ? (
            <View>
              <Text style={styles.section}>Now playing</Text>
              <View style={styles.row}>
                <Artwork uri={nowPlaying.artworkUrl} size={44} radius={4} />
                <View style={styles.text}>
                  <View style={styles.nowLine}>
                    <PlayingBars color={accent} active={player.isPlaying} />
                    <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
                      {nowPlaying.title}
                    </Text>
                  </View>
                  <Text style={styles.artist} numberOfLines={1}>
                    {nowPlaying.artist}
                  </Text>
                </View>
              </View>
              <Text style={styles.section}>Next up</Text>
              {upNext.length === 0 && (
                <Text style={styles.empty}>Nothing queued. Autoplay will continue with similar songs.</Text>
              )}
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 56 },
  heading: { flex: 1, color: palette.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  headerSpacer: { width: 28 },
  section: { color: palette.text, fontSize: 17, fontWeight: '700', paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, height: 62, backgroundColor: palette.bg },
  rowActive: { backgroundColor: palette.elevated },
  text: { flex: 1, marginHorizontal: 12 },
  nowLine: { flexDirection: 'row', alignItems: 'center' },
  title: { color: palette.text, fontSize: 15, fontWeight: '500', flexShrink: 1 },
  artist: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  handle: { paddingHorizontal: 8, paddingVertical: 12 },
  empty: { color: palette.textSecondary, fontSize: 14, paddingHorizontal: 16, paddingVertical: 12 },
});
