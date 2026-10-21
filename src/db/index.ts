import * as SQLite from 'expo-sqlite';
import { useEffect, useState, useSyncExternalStore } from 'react';

const DATABASE_VERSION = 2;

let db: SQLite.SQLiteDatabase | null = null;
let ready: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE tracks (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT '',
      album TEXT,
      artwork_url TEXT,
      duration_ms INTEGER,
      norm_text TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE likes (
      track_id TEXT PRIMARY KEY NOT NULL REFERENCES tracks(id),
      liked_at INTEGER NOT NULL
    );
    CREATE TABLE plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL REFERENCES tracks(id),
      played_at INTEGER NOT NULL,
      listened_ms INTEGER NOT NULL
    );
    CREATE INDEX plays_track ON plays(track_id);
    CREATE INDEX plays_time ON plays(played_at);
    CREATE TABLE playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE playlist_tracks (
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      track_id TEXT NOT NULL REFERENCES tracks(id),
      position INTEGER NOT NULL,
      added_at INTEGER NOT NULL
    );
    CREATE INDEX playlist_tracks_pl ON playlist_tracks(playlist_id, position);
    CREATE TABLE search_history (
      query TEXT PRIMARY KEY NOT NULL,
      searched_at INTEGER NOT NULL
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE feed_cache (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
  `,
  // Plays remember the album/playlist they came from, so history can show the collection once.
  2: `
    ALTER TABLE plays ADD COLUMN context_key TEXT;
    CREATE INDEX plays_context ON plays(context_key);
    CREATE TABLE contexts (
      key TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      ref TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      artwork_url TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE saved_albums (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT '',
      artwork_url TEXT,
      saved_at INTEGER NOT NULL
    );
  `,
};

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < DATABASE_VERSION) {
    const next = version + 1;
    await database.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[next]);
      await txn.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!ready) {
    ready = SQLite.openDatabaseAsync('emusic.db').then(async (database) => {
      await migrate(database);
      db = database;
      return database;
    });
  }
  return ready;
}

// Change notification: writes bump a version per table group; hooks re-query on change.

export type DataTopic = 'likes' | 'plays' | 'playlists' | 'searches' | 'settings' | 'tracks' | 'albums';

const versions: Record<DataTopic, number> = {
  likes: 0,
  plays: 0,
  playlists: 0,
  searches: 0,
  settings: 0,
  tracks: 0,
  albums: 0,
};
const listeners = new Set<() => void>();

export function notify(...topics: DataTopic[]): void {
  topics.forEach((t) => {
    versions[t] += 1;
  });
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useTopicVersion(topics: DataTopic[]): string {
  return useSyncExternalStore(subscribe, () => topics.map((t) => versions[t]).join('.'));
}

/** Runs an async query and re-runs it whenever one of the given topics changes. */
export function useDbQuery<T>(
  topics: DataTopic[],
  query: (database: SQLite.SQLiteDatabase) => Promise<T>,
  initial: T,
  deps: readonly unknown[] = [],
): T {
  const version = useTopicVersion(topics);
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then(query)
      .then((result) => {
        if (!cancelled) setValue(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return value;
}

// Shared queries: one result per key for all components, loaded once per data change
// instead of once per mounted component (likes are read by every track row's host).

interface SharedEntry {
  value: unknown;
  wanted: string | null;
  loadedFor: string | null;
  loading: boolean;
  listeners: Set<() => void>;
}

const shared = new Map<string, SharedEntry>();

function loadShared(entry: SharedEntry, query: (database: SQLite.SQLiteDatabase) => Promise<unknown>): void {
  if (entry.loading || entry.loadedFor === entry.wanted) return;
  entry.loading = true;
  const target = entry.wanted;
  getDb()
    .then(query)
    .then((result) => {
      entry.value = result;
      entry.listeners.forEach((l) => l());
    })
    .catch(() => undefined)
    .finally(() => {
      // Marked loaded even on error, so a failing query is not retried in a loop.
      entry.loadedFor = target;
      entry.loading = false;
      // Data changed while this load ran: load again for the newest version.
      loadShared(entry, query);
    });
}

export function useSharedDbQuery<T>(
  key: string,
  topics: DataTopic[],
  query: (database: SQLite.SQLiteDatabase) => Promise<T>,
  initial: T,
): T {
  const version = useTopicVersion(topics);
  let entry = shared.get(key);
  if (!entry) {
    entry = { value: initial, wanted: null, loadedFor: null, loading: false, listeners: new Set() };
    shared.set(key, entry);
  }
  const current = entry;

  const value = useSyncExternalStore(
    (l) => {
      current.listeners.add(l);
      return () => current.listeners.delete(l);
    },
    () => current.value as T,
  );

  useEffect(() => {
    current.wanted = version;
    loadShared(current, query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  return value;
}

export const isDbReady = (): boolean => db !== null;
