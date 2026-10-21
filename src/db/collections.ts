import { getDb, notify, useDbQuery } from './index';
import { rowToTrack, TRACK_COLUMNS, type TrackRow } from './tracks';
import type { AlbumRef, Track } from '../sources/types';

/** A collection playback started from; plays from it show up once in history. */
export interface PlayContext {
  key: string;
  kind: 'album' | 'playlist' | 'liked' | 'artist';
  /** Album id, playlist id or artist name, used to reopen it. */
  ref: string;
  title: string;
  subtitle: string;
  artworkUrl: string | null;
}

export const albumContext = (a: { id: string; name: string; artist: string; artworkUrl: string | null }): PlayContext => ({
  key: `album:${a.id}`,
  kind: 'album',
  ref: a.id,
  title: a.name,
  subtitle: a.artist,
  artworkUrl: a.artworkUrl,
});

export const playlistContext = (id: number, name: string, artworkUrl: string | null): PlayContext => ({
  key: `playlist:${id}`,
  kind: 'playlist',
  ref: String(id),
  title: name,
  subtitle: 'Playlist',
  artworkUrl,
});

export const LIKED_CONTEXT: PlayContext = {
  key: 'liked',
  kind: 'liked',
  ref: 'liked',
  title: 'Liked Songs',
  subtitle: 'Playlist',
  artworkUrl: null,
};

export const artistContext = (name: string, artworkUrl: string | null): PlayContext => ({
  key: `artist:${name.toLowerCase()}`,
  kind: 'artist',
  ref: name,
  title: name,
  subtitle: 'Artist',
  artworkUrl,
});

export async function rememberContext(ctx: PlayContext): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO contexts (key, kind, ref, title, subtitle, artwork_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET title = excluded.title, subtitle = excluded.subtitle,
       artwork_url = COALESCE(excluded.artwork_url, contexts.artwork_url), updated_at = excluded.updated_at`,
    ctx.key,
    ctx.kind,
    ctx.ref,
    ctx.title,
    ctx.subtitle,
    ctx.artworkUrl,
    Date.now(),
  );
}

export type RecentItem = { kind: 'track'; key: string; track: Track } | { kind: 'context'; key: string; context: PlayContext };

interface ContextRow {
  key: string;
  kind: PlayContext['kind'];
  ref: string;
  title: string;
  subtitle: string;
  artwork_url: string | null;
}

/** History with collection plays folded into one entry per album/playlist. */
export function useRecentItems(limit = 20): RecentItem[] {
  return useDbQuery(
    ['plays', 'tracks'],
    async (db) => {
      const keys = await db.getAllAsync<{ key: string; track_id: string; last: number }>(
        `SELECT COALESCE(context_key, 'track:' || track_id) AS key, MAX(track_id) AS track_id, MAX(played_at) AS last
         FROM plays GROUP BY key ORDER BY last DESC LIMIT ?`,
        limit,
      );
      if (keys.length === 0) return [];
      const marks = keys.map(() => '?').join(',');
      const contexts = await db.getAllAsync<ContextRow>(
        `SELECT key, kind, ref, title, subtitle, artwork_url FROM contexts WHERE key IN (${marks})`,
        keys.map((k) => k.key),
      );
      const tracks = await db.getAllAsync<TrackRow>(
        `SELECT ${TRACK_COLUMNS} FROM tracks t WHERE t.id IN (${marks})`,
        keys.map((k) => k.track_id),
      );
      const ctxByKey = new Map(contexts.map((c) => [c.key, c]));
      const trackById = new Map(tracks.map((t) => [t.id, rowToTrack(t)]));

      const items: RecentItem[] = [];
      for (const k of keys) {
        const ctx = ctxByKey.get(k.key);
        if (ctx) {
          const { artwork_url, ...rest } = ctx;
          items.push({ kind: 'context', key: k.key, context: { ...rest, artworkUrl: artwork_url } });
        } else {
          // Single plays, or a collection whose details were never stored: show the track.
          const track = trackById.get(k.track_id);
          if (track) items.push({ kind: 'track', key: k.key, track });
        }
      }
      return items;
    },
    [],
    [limit],
  );
}

// Saved albums

export async function setAlbumSaved(album: AlbumRef, saved: boolean): Promise<void> {
  const db = await getDb();
  if (saved) {
    await db.runAsync(
      `INSERT INTO saved_albums (id, name, artist, artwork_url, saved_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, artist = excluded.artist, artwork_url = excluded.artwork_url`,
      album.id,
      album.name,
      album.artist,
      album.artworkUrl,
      Date.now(),
    );
  } else {
    await db.runAsync('DELETE FROM saved_albums WHERE id = ?', album.id);
  }
  notify('albums');
}

export function useSavedAlbums(): AlbumRef[] {
  return useDbQuery(
    ['albums'],
    async (db) =>
      (
        await db.getAllAsync<{ id: string; name: string; artist: string; artwork_url: string | null }>(
          'SELECT id, name, artist, artwork_url FROM saved_albums ORDER BY saved_at DESC',
        )
      ).map((r) => ({ kind: 'album' as const, id: r.id, name: r.name, artist: r.artist, artworkUrl: r.artwork_url, source: 'youtube' as const })),
    [],
  );
}

export function useIsAlbumSaved(id: string): boolean {
  return useDbQuery(
    ['albums'],
    async (db) => (await db.getFirstAsync<{ id: string }>('SELECT id FROM saved_albums WHERE id = ?', id)) !== null,
    false,
    [id],
  );
}
