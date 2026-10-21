import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import EPlayer, { type PlayerProgress, type PlayerSnapshot } from '../../modules/e-player';
import { refreshOffline, syncLikedDownloads } from '../offline/offline';
import { syncPlayLog } from './history';

const EMPTY_SNAPSHOT: PlayerSnapshot = {
  state: 'idle',
  isPlaying: false,
  playWhenReady: false,
  index: -1,
  trackId: null,
  track: null,
  queueLength: 0,
  repeatMode: 'off',
  shuffle: false,
  error: null,
};

const PlayerContext = createContext<PlayerSnapshot>(EMPTY_SNAPSHOT);

/** One native subscription for the whole app. Connecting also starts the playback service. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>(EMPTY_SNAPSHOT);
  const lastTrack = useRef<string | null>(null);

  useEffect(() => {
    const sub = EPlayer.addListener('onStateChange', (next) => {
      setSnapshot(next);
      // History is written natively; pull it in whenever the track changes.
      if (next.trackId !== lastTrack.current) {
        lastTrack.current = next.trackId;
        syncPlayLog().then(refreshOffline).catch(() => undefined);
      }
    });
    EPlayer.connect().then(setSnapshot).catch(() => undefined);
    syncPlayLog().then(syncLikedDownloads).catch(() => undefined);
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncPlayLog();
    });
    return () => {
      sub.remove();
      appSub.remove();
    };
  }, []);

  return createElement(PlayerContext.Provider, { value: snapshot }, children);
}

export const usePlayer = (): PlayerSnapshot => useContext(PlayerContext);

const ZERO: PlayerProgress = { positionMs: 0, bufferedMs: 0, durationMs: null };

/** Polls position while mounted and the app is in the foreground; the native side never pushes progress. */
export function usePlayerProgress(intervalMs = 500, enabled = true): PlayerProgress {
  const [progress, setProgress] = useState<PlayerProgress>(ZERO);

  useEffect(() => {
    if (!enabled) return undefined;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      EPlayer.getProgress().then(setProgress).catch(() => undefined);
    };
    const start = () => {
      if (timer === null) {
        tick();
        timer = setInterval(tick, intervalMs);
      }
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [intervalMs, enabled]);

  return progress;
}
