import * as youtube from './youtube';
import * as audius from './audius';
import { searchLocal } from './local';
import type { AlbumRef, ArtistRef, Track } from './types';

export interface SearchResults {
  query: string;
  local: Track[];
  songs: Track[];
  artists: ArtistRef[];
  albums: AlbumRef[];
  audius: Track[];
  /** Sources that failed; the rest still show. */
  failed: string[];
}

async function settle<T>(promise: Promise<T>, label: string, failed: string[], fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    failed.push(label);
    return fallback;
  }
}

/** Queries every source in parallel; one failing source never blanks the whole result. */
export async function searchAll(query: string): Promise<SearchResults> {
  const failed: string[] = [];
  const [songs, artists, albums, audiusTracks] = await Promise.all([
    settle(youtube.searchSongs(query), 'YouTube Music', failed, []),
    settle(youtube.searchArtists(query), 'YouTube Music', failed, []),
    settle(youtube.searchAlbums(query), 'YouTube Music', failed, []),
    settle(audius.searchSongs(query, 8), 'Audius', failed, []),
  ]);
  return {
    query,
    local: searchLocal(query, 8),
    songs,
    artists: dedupeArtists(artists).slice(0, 6),
    albums: albums.slice(0, 12),
    audius: audiusTracks,
    failed: [...new Set(failed)],
  };
}

// YouTube often returns the same artist twice (Topic channel + official channel).
function dedupeArtists(artists: ArtistRef[]): ArtistRef[] {
  const seen = new Set<string>();
  return artists.filter((a) => {
    const key = a.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export interface ArtistPage {
  name: string;
  artworkUrl: string | null;
  songs: Track[];
  albums: AlbumRef[];
}

/** Artist pages are assembled from search, since YouTube Music "Topic" channels expose no tabs. */
export async function getArtistPage(name: string, artworkUrl: string | null): Promise<ArtistPage> {
  const key = name.toLowerCase();
  const [songs, albums] = await Promise.all([youtube.searchSongs(name), youtube.searchAlbums(name)]);
  const own = songs.filter((s) => s.artist.toLowerCase().includes(key));
  return {
    name,
    artworkUrl,
    songs: own.length >= 3 ? own : songs,
    albums: albums.filter((a) => a.artist.toLowerCase().includes(key)),
  };
}
