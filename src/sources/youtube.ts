import EPlayer from '../../modules/e-player';
import type { AlbumDetail, AlbumRef, ArtistRef, Track } from './types';

export async function searchSongs(query: string): Promise<Track[]> {
  const results = await EPlayer.ytSearch(query, 'songs');
  return results.map(({ kind: _kind, artistUrl: _artistUrl, ...track }) => track);
}

export async function searchArtists(query: string): Promise<ArtistRef[]> {
  const results = await EPlayer.ytSearch(query, 'artists');
  return results.map((a) => ({ ...a, source: 'youtube' as const }));
}

export async function searchAlbums(query: string): Promise<AlbumRef[]> {
  const results = await EPlayer.ytSearch(query, 'albums');
  return results.map((a) => ({ ...a, source: 'youtube' as const }));
}

export const suggestions = (query: string): Promise<string[]> => EPlayer.ytSuggestions(query);

export async function getAlbum(id: string): Promise<AlbumDetail> {
  const album = await EPlayer.ytAlbum(id);
  return { kind: 'album', source: 'youtube', ...album, trackCount: album.tracks.length };
}

export const related = (track: Track): Promise<Track[]> =>
  track.source === 'youtube' ? EPlayer.ytRelated(track.id) : Promise.resolve([]);
