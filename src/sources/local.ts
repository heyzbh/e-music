import { PermissionsAndroid, Platform } from 'react-native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import EPlayer from '../../modules/e-player';
import type { Track } from './types';
import { matchesQuery, normalize } from '../utils/text';

// MediaStore-backed library. The folder scanner with tag editing replaces this later;
// the interface (tracks + search) stays the same.

interface LocalState {
  status: 'unknown' | 'denied' | 'loading' | 'ready';
  tracks: Track[];
}

let state: LocalState = { status: 'unknown', tracks: [] };
let index: { track: Track; key: string }[] = [];
const listeners = new Set<() => void>();

function setState(next: LocalState) {
  state = next;
  index = next.tracks.map((track) => ({ track, key: normalize(`${track.title} ${track.artist} ${track.album ?? ''}`) }));
  listeners.forEach((l) => l());
}

const permission = () =>
  Number(Platform.Version) >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

/** Loads the library; asks for permission only when `ask` is true. */
export async function loadLocalLibrary(ask: boolean): Promise<void> {
  const granted = ask
    ? (await PermissionsAndroid.request(permission())) === PermissionsAndroid.RESULTS.GRANTED
    : await PermissionsAndroid.check(permission());
  if (!granted) {
    setState({ status: ask ? 'denied' : 'unknown', tracks: [] });
    return;
  }
  setState({ status: 'loading', tracks: state.tracks });
  const tracks = await EPlayer.queryDeviceAudio(10_000);
  setState({ status: 'ready', tracks });
}

export function useLocalLibrary(): LocalState {
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    if (!requested && snapshot.status === 'unknown') {
      setRequested(true);
      loadLocalLibrary(false).catch(() => undefined);
    }
  }, [requested, snapshot.status]);
  return snapshot;
}

export function searchLocal(query: string, limit = 20): Track[] {
  const q = normalize(query);
  if (!q) return [];
  const out: Track[] = [];
  for (const entry of index) {
    if (matchesQuery(entry.key, q)) {
      out.push(entry.track);
      if (out.length >= limit) break;
    }
  }
  return out;
}
