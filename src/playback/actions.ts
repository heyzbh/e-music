import * as Haptics from 'expo-haptics';
import EPlayer from '../../modules/e-player';
import { getDb } from '../db';
import { rememberContext, type PlayContext } from '../db/collections';
import { upsertTracks } from '../db/tracks';
import type { Track } from '../sources/types';
import { showToast } from '../components/Toast';

// Queue limits keep the MediaSession payload small; ExoPlayer itself has no practical limit.
const MAX_QUEUE = 500;

function remember(tracks: Track[]) {
  getDb()
    .then((db) => upsertTracks(db, tracks))
    .catch(() => undefined);
}

function report(e: unknown) {
  showToast(e instanceof Error ? e.message : 'Playback error');
}

/**
 * Replaces the queue. With a context (album, playlist, ...), each track carries its key so
 * history shows the collection once instead of every song from it.
 */
export function playTracks(tracks: Track[], startIndex = 0, shuffle = false, context?: PlayContext): void {
  if (tracks.length === 0) return;
  Haptics.selectionAsync().catch(() => undefined);
  if (context) rememberContext(context).catch(() => undefined);
  const start = Math.max(0, Math.min(startIndex, tracks.length - 1));
  // Keep the chosen track inside the capped window.
  const from = Math.max(0, Math.min(start - 50, tracks.length - MAX_QUEUE));
  const window = tracks.slice(from, from + MAX_QUEUE).map((t) => ({ ...t, context: context?.key ?? null }));
  const index = shuffle ? Math.floor(Math.random() * window.length) : start - from;
  remember(window);
  EPlayer.setShuffle(shuffle)
    .then(() => EPlayer.setQueue(window, index, 0, true))
    .catch(report);
}

// Single tracks added by hand are their own history entry, whatever list they came from.
export function playNext(track: Track): void {
  remember([track]);
  EPlayer.playNext([{ ...track, context: null }])
    .then(() => showToast('Playing next'))
    .catch(report);
}

export function addToQueue(track: Track): void {
  remember([track]);
  EPlayer.add([{ ...track, context: null }], null)
    .then(() => showToast('Added to queue'))
    .catch(report);
}

export function togglePlay(playing: boolean): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  (playing ? EPlayer.pause() : EPlayer.play()).catch(report);
}

export const next = () => EPlayer.next().catch(report);
export const previous = () => EPlayer.previous().catch(report);
export const seekTo = (ms: number) => EPlayer.seekTo(ms).catch(report);
