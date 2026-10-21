import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Artwork } from './Artwork';

/** 2x2 mosaic of the first covers, like Spotify; a single cover or icon when there are fewer. */
export function PlaylistCover({ covers, size }: { covers: string[]; size: number }) {
  if (covers.length >= 4) {
    const half = size / 2;
    return (
      <View style={[styles.grid, { width: size, height: size }]}>
        {covers.slice(0, 4).map((c) => (
          <Artwork key={c} uri={c} size={half} radius={0} />
        ))}
      </View>
    );
  }
  if (covers.length > 0) return <Artwork uri={covers[0]} size={size} radius={4} />;
  return (
    <LinearGradient colors={['#333340', '#1c1c22']} style={[styles.empty, { width: size, height: size }]}>
      <Ionicons name="musical-notes-outline" size={size * 0.42} color="#8a8a96" />
    </LinearGradient>
  );
}

export function LikedCover({ size }: { size: number }) {
  return (
    <LinearGradient colors={['#4a2fd6', '#8fb4e8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.empty, { width: size, height: size }]}>
      <Ionicons name="heart" size={size * 0.42} color="#fff" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 4, overflow: 'hidden' },
  empty: { alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
});
