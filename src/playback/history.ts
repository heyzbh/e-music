import EPlayer from '../../modules/e-player';
import { recordPlays } from '../db/library';

let syncing: Promise<void> | null = null;

/** Moves plays logged by the native service into SQLite. Safe to call often. */
export function syncPlayLog(): Promise<void> {
  if (!syncing) {
    syncing = EPlayer.drainPlayLog()
      .then(recordPlays)
      .catch(() => undefined)
      .finally(() => {
        syncing = null;
      });
  }
  return syncing;
}
