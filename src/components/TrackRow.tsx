import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Track } from '../sources/types';
import { palette } from '../theme/colors';
import { formatDuration } from '../utils/text';
import { Artwork } from './Artwork';
import { IconButton } from './IconButton';
import { PlayingBars } from './PlayingBars';
import { SourceBadge } from './SourceBadge';

interface Props {
  track: Track;
  onPress: () => void;
  onMore: () => void;
  active: boolean;
  playing: boolean;
  liked: boolean;
  /** Playable without network (downloaded or fully cached). */
  offline?: boolean;
  accent: string;
  /** Album screens show the track number instead of artwork. */
  number?: number;
  showDuration?: boolean;
}

function TrackRowImpl({ track, onPress, onMore, active, playing, liked, offline, accent, number, showDuration }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      delayLongPress={300}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {number != null ? (
        <View style={styles.number}>
          {active ? (
            <PlayingBars color={accent} active={playing} />
          ) : (
            <Text style={styles.numberText}>{number}</Text>
          )}
        </View>
      ) : (
        <Artwork uri={track.artworkUrl} size={50} />
      )}
      <View style={styles.text}>
        <View style={styles.titleLine}>
          {active && number == null && <PlayingBars color={accent} active={playing} />}
          <Text style={[styles.title, active && { color: accent }]} numberOfLines={1}>
            {track.title}
          </Text>
        </View>
        <View style={styles.subLine}>
          {liked && <Ionicons name="heart" size={12} color={accent} style={styles.likedIcon} />}
          {offline && <Ionicons name="arrow-down-circle" size={13} color={accent} style={styles.likedIcon} />}
          <SourceBadge source={track.source} />
          <Text style={styles.subtitle} numberOfLines={1}>
            {track.artist || 'Unknown artist'}
            {showDuration && track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ''}
          </Text>
        </View>
      </View>
      <IconButton name="ellipsis-vertical" size={18} color={palette.textSecondary} onPress={onMore} accessibilityLabel="More" />
    </Pressable>
  );
}

export const TrackRow = memo(TrackRowImpl);

export const TRACK_ROW_HEIGHT = 64;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: TRACK_ROW_HEIGHT, paddingLeft: 16, paddingRight: 10 },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  number: { width: 28, alignItems: 'center' },
  numberText: { color: palette.textSecondary, fontSize: 15 },
  text: { flex: 1, marginLeft: 12, marginRight: 8 },
  titleLine: { flexDirection: 'row', alignItems: 'center' },
  title: { color: palette.text, fontSize: 16, fontWeight: '500', flexShrink: 1 },
  subLine: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  likedIcon: { marginRight: 5 },
  subtitle: { color: palette.textSecondary, fontSize: 13, flexShrink: 1 },
});
