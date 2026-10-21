import { StyleSheet, Text, View } from 'react-native';
import type { TrackSource } from '../sources/types';

const STYLE: Record<TrackSource, { label: string; bg: string; fg: string }> = {
  youtube: { label: 'YT', bg: '#ff000026', fg: '#ff6b6b' },
  audius: { label: 'AUDIUS', bg: '#a855f726', fg: '#c79bff' },
  local: { label: 'LOCAL', bg: '#ffffff1f', fg: '#c9c9d1' },
};

export function SourceBadge({ source }: { source: TrackSource }) {
  const s = STYLE[source];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginRight: 6 },
  text: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
});
