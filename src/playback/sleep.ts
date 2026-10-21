import { useSyncExternalStore } from 'react';
import EPlayer from '../../modules/e-player';

// The timer runs in the native service; this only mirrors it for the UI.

export type SleepState = { kind: 'off' } | { kind: 'at'; endsAt: number } | { kind: 'endOfTrack' };

let state: SleepState = { kind: 'off' };
const listeners = new Set<() => void>();

function set(next: SleepState) {
  state = next;
  listeners.forEach((l) => l());
}

export async function setSleepTimer(minutes: number | 'endOfTrack' | 'off'): Promise<void> {
  if (minutes === 'off') {
    await EPlayer.setSleepTimer(0, false);
    set({ kind: 'off' });
  } else if (minutes === 'endOfTrack') {
    await EPlayer.setSleepTimer(0, true);
    set({ kind: 'endOfTrack' });
  } else {
    await EPlayer.setSleepTimer(minutes, false);
    set({ kind: 'at', endsAt: Date.now() + minutes * 60_000 });
  }
}

export function useSleepTimer(): SleepState {
  const current = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  return current.kind === 'at' && current.endsAt < Date.now() ? { kind: 'off' } : current;
}
