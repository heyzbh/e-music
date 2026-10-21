import type { SQLiteDatabase } from 'expo-sqlite';
import type { Track, TrackSource } from '../sources/types';
import { normalize } from '../utils/text';

export interface TrackRow {
  id: string;
  source: string;
  url: string;
  title: string;
  artist: string;
  album: string | null;
  artwork_url: string | null;
  duration_ms: number | null;
}

export const TRACK_COLUMNS = 't.id, t.source, t.url, t.title, t.artist, t.album, t.artwork_url, t.duration_ms';

export function rowToTrack(row: TrackRow): Track {
  return {
    id: row.id,
    source: row.source as TrackSource,
    url: row.url,
    title: row.title,
    artist: row.artist,
    album: row.album,
    artworkUrl: row.artwork_url,
    durationMs: row.duration_ms,
  };
}

/** Stores a track so likes, playlists and history can reference it; refreshes metadata. */
export async function upsertTracks(db: SQLiteDatabase, tracks: Track[]): Promise<void> {
  if (tracks.length === 0) return;
  const statement = await db.prepareAsync(`
    INSERT INTO tracks (id, source, url, title, artist, album, artwork_url, duration_ms, norm_text, updated_at)
    VALUES ($id, $source, $url, $title, $artist, $album, $artwork, $duration, $norm, $now)
    ON CONFLICT(id) DO UPDATE SET
      url = excluded.url, title = excluded.title, artist = excluded.artist,
      album = COALESCE(excluded.album, tracks.album),
      artwork_url = COALESCE(excluded.artwork_url, tracks.artwork_url),
      duration_ms = COALESCE(excluded.duration_ms, tracks.duration_ms),
      norm_text = excluded.norm_text, updated_at = excluded.updated_at
  `);
  try {
    const now = Date.now();
    for (const t of tracks) {
      await statement.executeAsync({
        $id: t.id,
        $source: t.source,
        $url: t.url,
        $title: t.title,
        $artist: t.artist,
        $album: t.album ?? null,
        $artwork: t.artworkUrl ?? null,
        $duration: t.durationMs != null ? Math.round(t.durationMs) : null,
        $norm: normalize(`${t.title} ${t.artist} ${t.album ?? ''}`),
        $now: now,
      });
    }
  } finally {
    await statement.finalizeAsync();
  }
}
