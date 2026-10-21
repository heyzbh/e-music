import { getDb, notify, useDbQuery, useSharedDbQuery } from './index';
import { rowToTrack, TRACK_COLUMNS, upsertTracks, type TrackRow } from './tracks';
import type { Track } from '../sources/types';

export interface PlaylistSummary {
  id: number;
  name: string;
  trackCount: number;
  covers: string[];
  updatedAt: number;
}

export async function createPlaylist(name: string, tracks: Track[] = []): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const result = await db.runAsync(
    'INSERT INTO playlists (name, created_at, updated_at) VALUES (?, ?, ?)',
    name.trim() || 'New playlist',
    now,
    now,
  );
  const id = result.lastInsertRowId;
  if (tracks.length > 0) await addToPlaylist(id, tracks);
  notify('playlists');
  return id;
}

export async function renamePlaylist(id: number, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?', name.trim(), Date.now(), id);
  notify('playlists');
}

export async function deletePlaylist(id: number): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM playlist_tracks WHERE playlist_id = ?', id);
    await txn.runAsync('DELETE FROM playlists WHERE id = ?', id);
  });
  notify('playlists');
}

export async function addToPlaylist(id: number, tracks: Track[]): Promise<void> {
  const db = await getDb();
  await upsertTracks(db, tracks);
  const row = await db.getFirstAsync<{ maxPos: number | null }>(
    'SELECT MAX(position) AS maxPos FROM playlist_tracks WHERE playlist_id = ?',
    id,
  );
  let position = (row?.maxPos ?? -1) + 1;
  const now = Date.now();
  for (const t of tracks) {
    await db.runAsync(
      'INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)',
      id,
      t.id,
      position,
      now,
    );
    position += 1;
  }
  await db.runAsync('UPDATE playlists SET updated_at = ? WHERE id = ?', now, id);
  notify('playlists');
}

/** Rewrites positions to match the given order of track ids (after drag-to-reorder or removal). */
export async function setPlaylistOrder(id: number, trackIds: string[]): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM playlist_tracks WHERE playlist_id = ?', id);
    for (let i = 0; i < trackIds.length; i += 1) {
      await txn.runAsync(
        'INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)',
        id,
        trackIds[i],
        i,
        now,
      );
    }
    await txn.runAsync('UPDATE playlists SET updated_at = ? WHERE id = ?', now, id);
  });
  notify('playlists');
}

export function usePlaylists(): PlaylistSummary[] {
  return useSharedDbQuery(
    'playlists',
    ['playlists', 'tracks'],
    async (db) => {
      const rows = await db.getAllAsync<{ id: number; name: string; updated_at: number; n: number }>(
        `SELECT p.id, p.name, p.updated_at, COUNT(pt.track_id) AS n
         FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
         GROUP BY p.id ORDER BY p.updated_at DESC`,
      );
      const covers = await db.getAllAsync<{ playlist_id: number; artwork_url: string }>(
        `SELECT pt.playlist_id, t.artwork_url FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
         WHERE t.artwork_url IS NOT NULL ORDER BY pt.playlist_id, pt.position`,
      );
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        trackCount: r.n,
        updatedAt: r.updated_at,
        covers: [...new Set(covers.filter((c) => c.playlist_id === r.id).map((c) => c.artwork_url))].slice(0, 4),
      }));
    },
    [],
  );
}

export function usePlaylist(id: number): { name: string; tracks: Track[] } | null {
  return useDbQuery(
    ['playlists', 'tracks'],
    async (db) => {
      const meta = await db.getFirstAsync<{ name: string }>('SELECT name FROM playlists WHERE id = ?', id);
      if (!meta) return null;
      const rows = await db.getAllAsync<TrackRow>(
        `SELECT ${TRACK_COLUMNS} FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
         WHERE pt.playlist_id = ? ORDER BY pt.position`,
        id,
      );
      return { name: meta.name, tracks: rows.map(rowToTrack) };
    },
    null,
    [id],
  );
}
