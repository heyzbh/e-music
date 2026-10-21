import { getDb, notify, useDbQuery, useSharedDbQuery } from './index';
import { onLikeChanged } from '../offline/offline';
import { rowToTrack, TRACK_COLUMNS, upsertTracks, type TrackRow } from './tracks';
import type { Track } from '../sources/types';

// Likes

export async function setLiked(track: Track, liked: boolean): Promise<void> {
  const db = await getDb();
  if (liked) {
    await upsertTracks(db, [track]);
    await db.runAsync('INSERT OR IGNORE INTO likes (track_id, liked_at) VALUES (?, ?)', track.id, Date.now());
  } else {
    await db.runAsync('DELETE FROM likes WHERE track_id = ?', track.id);
  }
  notify('likes');
  onLikeChanged(track, liked).catch(() => undefined);
}

export function useLikedIds(): Set<string> {
  return useSharedDbQuery(
    'likedIds',
    ['likes'],
    async (db) => new Set((await db.getAllAsync<{ track_id: string }>('SELECT track_id FROM likes')).map((r) => r.track_id)),
    new Set<string>(),
  );
}

export function useLikedTracks(): Track[] {
  return useDbQuery(
    ['likes', 'tracks'],
    async (db) =>
      (
        await db.getAllAsync<TrackRow>(
          `SELECT ${TRACK_COLUMNS} FROM likes l JOIN tracks t ON t.id = l.track_id ORDER BY l.liked_at DESC`,
        )
      ).map(rowToTrack),
    [],
  );
}

// History

/** Minimum listening time before a play counts toward "most played" and recommendations. */
export const COUNTED_PLAY_MS = 30_000;

export async function recordPlays(entries: { track: Track; listenedMs: number; playedAt: number }[]): Promise<void> {
  if (entries.length === 0) return;
  const db = await getDb();
  await upsertTracks(db, entries.map((e) => e.track));
  for (const e of entries) {
    await db.runAsync(
      'INSERT INTO plays (track_id, played_at, listened_ms, context_key) VALUES (?, ?, ?, ?)',
      e.track.id,
      Math.round(e.playedAt),
      Math.round(e.listenedMs),
      e.track.context ?? null,
    );
  }
  notify('plays', 'tracks');
}

export function useRecentlyPlayed(limit = 20): Track[] {
  return useDbQuery(
    ['plays', 'tracks'],
    async (db) =>
      (
        await db.getAllAsync<TrackRow>(
          `SELECT ${TRACK_COLUMNS} FROM tracks t
           JOIN (SELECT track_id, MAX(played_at) AS last FROM plays GROUP BY track_id) p ON p.track_id = t.id
           ORDER BY p.last DESC LIMIT ?`,
          limit,
        )
      ).map(rowToTrack),
    [],
    [limit],
  );
}

export function useMostPlayed(limit = 20): Track[] {
  return useDbQuery(
    ['plays', 'tracks'],
    async (db) =>
      (
        await db.getAllAsync<TrackRow>(
          `SELECT ${TRACK_COLUMNS} FROM tracks t
           JOIN (SELECT track_id, COUNT(*) AS n FROM plays WHERE listened_ms >= ? GROUP BY track_id) p ON p.track_id = t.id
           WHERE p.n >= 2 ORDER BY p.n DESC LIMIT ?`,
          COUNTED_PLAY_MS,
          limit,
        )
      ).map(rowToTrack),
    [],
    [limit],
  );
}

export interface ArtistStat {
  name: string;
  plays: number;
  artworkUrl: string | null;
}

/** Artists weighted by counted plays, with recent plays (30 days) counting double. */
export async function topArtists(limit: number): Promise<ArtistStat[]> {
  const db = await getDb();
  const since = Date.now() - 30 * 24 * 3600 * 1000;
  return db.getAllAsync<ArtistStat>(
    `SELECT t.artist AS name,
            SUM(CASE WHEN p.played_at >= ? THEN 2 ELSE 1 END) AS plays,
            MAX(t.artwork_url) AS artworkUrl
     FROM plays p JOIN tracks t ON t.id = p.track_id
     WHERE p.listened_ms >= ? AND t.artist <> ''
     GROUP BY LOWER(t.artist) ORDER BY plays DESC LIMIT ?`,
    since,
    COUNTED_PLAY_MS,
    limit,
  );
}

export function useTopArtists(limit = 10): ArtistStat[] {
  return useDbQuery(['plays'], () => topArtists(limit), [], [limit]);
}

export async function playedTrackIds(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ track_id: string }>('SELECT DISTINCT track_id FROM plays');
  return new Set(rows.map((r) => r.track_id));
}

// Search history

export async function addSearch(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO search_history (query, searched_at) VALUES (?, ?) ON CONFLICT(query) DO UPDATE SET searched_at = excluded.searched_at',
    q,
    Date.now(),
  );
  notify('searches');
}

export async function removeSearch(query: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM search_history WHERE query = ?', query);
  notify('searches');
}

export async function clearSearches(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM search_history');
  notify('searches');
}

export function useSearchHistory(limit = 12): string[] {
  return useDbQuery(
    ['searches'],
    async (db) =>
      (
        await db.getAllAsync<{ query: string }>('SELECT query FROM search_history ORDER BY searched_at DESC LIMIT ?', limit)
      ).map((r) => r.query),
    [],
    [limit],
  );
}

// Feed cache

export async function getCached<T>(key: string, maxAgeMs: number): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string; fetched_at: number }>(
    'SELECT value, fetched_at FROM feed_cache WHERE key = ?',
    key,
  );
  if (!row || Date.now() - row.fetched_at > maxAgeMs) return null;
  return JSON.parse(row.value) as T;
}

export async function setCached(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO feed_cache (key, value, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, fetched_at = excluded.fetched_at',
    key,
    JSON.stringify(value),
    Date.now(),
  );
}

export { getSetting, setSetting } from './settings';
