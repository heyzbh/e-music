import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Artwork } from '../components/Artwork';
import { IconButton } from '../components/IconButton';
import { EmptyState, SectionTitle, Shelf } from '../components/Shelf';
import { TrackRow } from '../components/TrackRow';
import { openTrackSheet } from '../components/TrackSheet';
import { useOffline } from '../offline/offline';
import { addSearch, clearSearches, removeSearch, useLikedIds, useSearchHistory } from '../db/library';
import type { SearchStackParams } from '../navigation/types';
import { playTracks } from '../playback/actions';
import { usePlayer } from '../playback/hooks';
import { searchAll, type SearchResults } from '../sources/search';
import * as youtube from '../sources/youtube';
import type { Track } from '../sources/types';
import { palette, radius } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { normalize } from '../utils/text';

type Nav = NativeStackNavigationProp<SearchStackParams>;
type Filter = 'all' | 'songs' | 'artists' | 'albums' | 'local' | 'audius';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'songs', label: 'Songs' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
  { key: 'local', label: 'On phone' },
  { key: 'audius', label: 'Audius' },
];

const GENRES = [
  { label: 'Balkan pop', query: 'balkan pop', color: '#e13300' },
  { label: 'Ex-Yu rap', query: 'ex yu rap', color: '#8d67ab' },
  { label: 'Narodna', query: 'narodna muzika', color: '#1e3264' },
  { label: 'Sevdah', query: 'sevdalinke', color: '#7d4b32' },
  { label: 'Turbo folk', query: 'turbo folk', color: '#d84000' },
  { label: 'Zabavna', query: 'zabavna muzika', color: '#148a08' },
  { label: 'Hip hop', query: 'hip hop', color: '#bc5900' },
  { label: 'Chill', query: 'chill mix', color: '#477d95' },
];

export default function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { accent } = useTheme();
  const player = usePlayer();
  const liked = useLikedIds();
  const offline = useOffline();
  const history = useSearchHistory();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const requestId = useRef(0);

  // Live suggestions while typing, debounced.
  useEffect(() => {
    const q = text.trim();
    if (!focused || q.length < 2 || q === results?.query) {
      setSuggestions([]);
      return undefined;
    }
    const t = setTimeout(() => {
      youtube
        .suggestions(q)
        .then((s) => setSuggestions(s.slice(0, 8)))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [text, focused, results?.query]);

  const runSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setText(q);
    setSuggestions([]);
    setFilter('all');
    setLoading(true);
    addSearch(q).catch(() => undefined);
    const id = ++requestId.current;
    searchAll(q)
      .then((r) => {
        if (id === requestId.current) setResults(r);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, []);

  const clear = () => {
    setText('');
    setResults(null);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const renderTracks = (tracks: Track[]) =>
    tracks.map((t, i) => (
      <TrackRow
        key={t.id}
        track={t}
        active={player.trackId === t.id}
        playing={player.isPlaying}
        liked={liked.has(t.id)}
        offline={offline.available.has(t.url)}
        accent={accent}
        showDuration
        onPress={() => playTracks(tracks, i)}
        onMore={() => openTrackSheet(t)}
      />
    ));

  const topArtist = useMemo(() => {
    if (!results) return null;
    const q = normalize(results.query);
    return results.artists.find((a) => normalize(a.name) === q || q.includes(normalize(a.name))) ?? null;
  }, [results]);

  const showTyping = focused && text.trim().length > 0 && text.trim() !== results?.query;
  const showHistory = focused && text.trim().length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>Search</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={22} color="#121212" />
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => runSearch(text)}
          placeholder="What do you want to listen to?"
          placeholderTextColor="#535353"
          returnKeyType="search"
          autoCorrect={false}
          selectionColor={accent}
          style={styles.input}
        />
        {text.length > 0 && <IconButton name="close" size={22} color="#121212" onPress={clear} accessibilityLabel="Clear" />}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        {showTyping ? (
          suggestions.map((s) => (
            <Pressable key={s} style={styles.suggestion} onPress={() => runSearch(s)}>
              <Ionicons name="search" size={18} color={palette.textSecondary} />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {s}
              </Text>
              <IconButton name="arrow-up-outline" size={18} color={palette.textTertiary} onPress={() => setText(`${s} `)} style={styles.fill} />
            </Pressable>
          ))
        ) : showHistory || (!results && !loading) ? (
          history.length > 0 && showHistory ? (
            <View>
              <SectionTitle title="Recent searches" action="Clear" onAction={() => clearSearches().catch(() => undefined)} />
              {history.map((h) => (
                <Pressable key={h} style={styles.suggestion} onPress={() => runSearch(h)}>
                  <Ionicons name="time-outline" size={20} color={palette.textSecondary} />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {h}
                  </Text>
                  <IconButton name="close" size={18} color={palette.textTertiary} onPress={() => removeSearch(h).catch(() => undefined)} />
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.browse}>
              <Text style={styles.browseTitle}>Browse</Text>
              <View style={styles.genres}>
                {GENRES.map((g) => (
                  <Pressable
                    key={g.label}
                    onPress={() => runSearch(g.query)}
                    style={({ pressed }) => [styles.genre, { backgroundColor: g.color, opacity: pressed ? 0.8 : 1 }]}
                  >
                    <Text style={styles.genreText}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        ) : loading ? (
          <ActivityIndicator color={accent} size="large" style={styles.loader} />
        ) : results ? (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
              {FILTERS.map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.chip, filter === f.key && { backgroundColor: accent }]}
                >
                  <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {results.failed.length > 0 && (
              <View style={styles.warning}>
                <Ionicons name="cloud-offline-outline" size={18} color={palette.textSecondary} />
                <Text style={styles.warningText}>{results.failed.join(', ')} unavailable right now. Showing other sources.</Text>
              </View>
            )}

            {filter === 'all' && (
              <>
                {topArtist && (
                  <Pressable
                    style={styles.top}
                    onPress={() => navigation.navigate('Artist', { name: topArtist.name, artworkUrl: topArtist.artworkUrl })}
                  >
                    <Artwork uri={topArtist.artworkUrl} size={92} round />
                    <Text style={styles.topName}>{topArtist.name}</Text>
                    <Text style={styles.topKind}>Artist</Text>
                  </Pressable>
                )}
                {results.songs.length > 0 && <SectionTitle title="Songs" action="See all" onAction={() => setFilter('songs')} />}
                {renderTracks(results.songs.slice(0, 5))}
                <View style={styles.gap} />
                <Shelf
                  title="Artists"
                  items={results.artists.map((a) => ({
                    key: a.id,
                    title: a.name,
                    subtitle: 'Artist',
                    artworkUrl: a.artworkUrl,
                    round: true,
                    onPress: () => navigation.navigate('Artist', { name: a.name, artworkUrl: a.artworkUrl }),
                  }))}
                />
                <Shelf
                  title="Albums"
                  items={results.albums.map((a) => ({
                    key: a.id,
                    title: a.name,
                    subtitle: a.artist,
                    artworkUrl: a.artworkUrl,
                    onPress: () => navigation.navigate('Album', { id: a.id, name: a.name, artist: a.artist, artworkUrl: a.artworkUrl }),
                  }))}
                />
                {results.local.length > 0 && <SectionTitle title="On this phone" />}
                {renderTracks(results.local)}
                {results.audius.length > 0 && (
                  <>
                    <View style={styles.gap} />
                    <SectionTitle title="From Audius" action="See all" onAction={() => setFilter('audius')} />
                    {renderTracks(results.audius.slice(0, 3))}
                  </>
                )}
              </>
            )}
            {filter === 'songs' && renderTracks(results.songs)}
            {filter === 'local' &&
              (results.local.length > 0 ? renderTracks(results.local) : <NoResults label="No matching songs on this phone" />)}
            {filter === 'audius' &&
              (results.audius.length > 0 ? renderTracks(results.audius) : <NoResults label="Nothing on Audius" />)}
            {filter === 'artists' &&
              results.artists.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.listRow}
                  onPress={() => navigation.navigate('Artist', { name: a.name, artworkUrl: a.artworkUrl })}
                >
                  <Artwork uri={a.artworkUrl} size={56} round />
                  <Text style={styles.listTitle}>{a.name}</Text>
                </Pressable>
              ))}
            {filter === 'albums' &&
              results.albums.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.listRow}
                  onPress={() => navigation.navigate('Album', { id: a.id, name: a.name, artist: a.artist, artworkUrl: a.artworkUrl })}
                >
                  <Artwork uri={a.artworkUrl} size={56} />
                  <View style={styles.fill}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={styles.listSub} numberOfLines={1}>
                      Album · {a.artist}
                    </Text>
                  </View>
                </Pressable>
              ))}
            {results.songs.length + results.artists.length + results.local.length + results.audius.length === 0 && (
              <EmptyState
                icon={<Ionicons name="search" size={48} color={palette.textTertiary} />}
                title={`No results for "${results.query}"`}
                message="Check the spelling or try a different search."
              />
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function NoResults({ label }: { label: string }) {
  return <Text style={styles.noResults}>{label}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  heading: { color: palette.text, fontSize: 26, fontWeight: '800', paddingHorizontal: 16, marginBottom: 14, letterSpacing: -0.5 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    height: 48,
  },
  input: { flex: 1, color: '#121212', fontSize: 16, fontWeight: '600', marginLeft: 10, paddingVertical: 0 },
  scroll: { paddingTop: 16, paddingBottom: 32 },
  suggestion: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  suggestionText: { flex: 1, color: palette.text, fontSize: 16, marginLeft: 14 },
  fill: { flex: 1 },
  browse: { paddingHorizontal: 16 },
  browseTitle: { color: palette.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  genre: { width: '48.5%', height: 96, borderRadius: radius.md, padding: 12, overflow: 'hidden' },
  genreText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  loader: { marginTop: 48 },
  chips: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  chip: { backgroundColor: palette.elevated, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  chipText: { color: palette.text, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
  },
  warningText: { color: palette.textSecondary, fontSize: 13, flex: 1 },
  top: { marginHorizontal: 16, marginBottom: 24, padding: 16, borderRadius: radius.md, backgroundColor: palette.surface },
  topName: { color: palette.text, fontSize: 26, fontWeight: '800', marginTop: 14 },
  topKind: { color: palette.textSecondary, fontSize: 14, marginTop: 4 },
  gap: { height: 24 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 14 },
  listTitle: { color: palette.text, fontSize: 16, fontWeight: '600' },
  listSub: { color: palette.textSecondary, fontSize: 13, marginTop: 2 },
  noResults: { color: palette.textSecondary, textAlign: 'center', marginTop: 32, fontSize: 14 },
});
