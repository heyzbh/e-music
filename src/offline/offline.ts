import { useSyncExternalStore } from 'react';
import EPlayer from '../../modules/e-player';
import { getDb } from '../db';
import { getSetting } from '../db/settings';
import { rowToTrack, TRACK_COLUMNS, type TrackRow } from '../db/tracks';
import type { Track } from '../sources/types';

// Mirrors which songs are saved offline. The audio itself lives in the native caches.

interface OfflineState {
  /** Track URLs saved on purpose (liked songs). */
  downloaded: Set<string>;
  /** Track URLs playable without network, including fully cached recent plays. */
  available: Set<string>;
  pending: number;
}

let state: OfflineState = { downloaded: new Set(), available: new Set(), pending: 0 };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function set(next: OfflineState) {
  state = next;
  listeners.forEach((l) => l());
}

export async function isDownloadLikedEnabled(): Promise<boolean> {
  return (await getSetting('downloadLiked')) !== '0';
}

async function likedTracks(): Promise<Track[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TrackRow>(
    `SELECT ${TRACK_COLUMNS} FROM likes l JOIN tracks t ON t.id = l.track_id`,
  );
  return rows.map(rowToTrack);
}

async function knownUrls(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ url: string }>("SELECT url FROM tracks WHERE source <> 'local'");
  return rows.map((r) => r.url);
}

/** Re-reads saved state; keeps polling while downloads are running. */
export async function refreshOffline(): Promise<void> {
  const [urls, liked, stats] = await Promise.all([knownUrls(), likedTracks(), EPlayer.offlineStats()]);
  const [downloaded, available] = await Promise.all([
    EPlayer.offlineDownloaded(liked.map((t) => t.url)),
    EPlayer.offlineAvailable(urls),
  ]);
  set({ downloaded: new Set(downloaded), available: new Set(available), pending: stats.pending });
  if (timer) clearTimeout(timer);
  timer = stats.pending > 0 ? setTimeout(() => refreshOffline().catch(() => undefined), 4000) : null;
}

/** Makes sure every liked song is saved (when enabled). Runs on start and after likes change. */
export async function syncLikedDownloads(): Promise<void> {
  if (await isDownloadLikedEnabled()) {
    const liked = (await likedTracks()).filter((t) => t.source !== 'local');
    await EPlayer.offlineDownload(liked);
  }
  await refreshOffline();
}

export async function onLikeChanged(track: Track, liked: boolean): Promise<void> {
  if (track.source === 'local') return;
  if (liked) {
    if (await isDownloadLikedEnabled()) await EPlayer.offlineDownload([track]);
  } else {
    await EPlayer.offlineRemove([track.url]);
  }
  await refreshOffline();
}

export async function removeAllDownloads(): Promise<void> {
  const liked = await likedTracks();
  await EPlayer.offlineRemove(liked.map((t) => t.url));
  await refreshOffline();
}

export function useOffline(): OfflineState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

