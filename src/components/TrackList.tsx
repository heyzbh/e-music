import { useCallback } from 'react';
import type { ListRenderItem } from 'react-native';
import type { PlayContext } from '../db/collections';
import { useLikedIds } from '../db/library';
import { useOffline } from '../offline/offline';
import { playTracks } from '../playback/actions';
import { usePlayer } from '../playback/hooks';
import type { Track } from '../sources/types';
import { useTheme } from '../theme/ThemeContext';
import { TrackRow } from './TrackRow';
import { openTrackSheet } from './TrackSheet';

interface Options {
  numbered?: boolean;
  showDuration?: boolean;
  /** Called with the row index to remove it from its collection (playlists). */
  onRemove?: (index: number) => void;
  /** Collection the list belongs to, so history groups its plays. */
  context?: PlayContext;
}

/** FlatList renderItem for a track collection; tapping a row plays the whole list from there. */
export function useTrackRenderer(tracks: Track[], options: Options = {}): ListRenderItem<Track> {
  const player = usePlayer();
  const liked = useLikedIds();
  const offline = useOffline();
  const { accent } = useTheme();
  const { numbered, showDuration, onRemove, context } = options;

  return useCallback<ListRenderItem<Track>>(
    ({ item, index }) => (
      <TrackRow
        track={item}
        active={player.trackId === item.id}
        playing={player.isPlaying}
        liked={liked.has(item.id)}
        offline={offline.available.has(item.url)}
        accent={accent}
        number={numbered ? index + 1 : undefined}
        showDuration={showDuration}
        onPress={() => playTracks(tracks, index, false, context)}
        onMore={() => openTrackSheet(item, onRemove ? () => onRemove(index) : undefined)}
      />
    ),
    [player.trackId, player.isPlaying, liked, offline, accent, numbered, showDuration, tracks, onRemove, context],
  );
}
