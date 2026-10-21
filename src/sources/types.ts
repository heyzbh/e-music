import type { PlayerTrack, TrackSource } from '../../modules/e-player';

export type Track = PlayerTrack;
export type { TrackSource };

export interface ArtistRef {
  kind: 'artist';
  id: string;
  name: string;
  artworkUrl: string | null;
  source: TrackSource;
}

export interface AlbumRef {
  kind: 'album';
  id: string;
  name: string;
  artist: string;
  artworkUrl: string | null;
  source: TrackSource;
  trackCount?: number;
}

export interface AlbumDetail extends AlbumRef {
  tracks: Track[];
}

export const SOURCE_LABEL: Record<TrackSource, string> = {
  youtube: 'YouTube Music',
  audius: 'Audius',
  local: 'On this phone',
};
