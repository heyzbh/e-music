import { useEffect, useState } from 'react';
import { getCached, playedTrackIds, setCached, topArtists } from '../db/library';
import { useDbQuery } from '../db';
import * as youtube from '../sources/youtube';
import type { Track } from '../sources/types';

const DAY = 24 * 3600 * 1000;

/** Starter shelves before there is any listening history. */
const DISCOVER_QUERIES = [
  { title: 'Balkan hits', query: 'balkan hitovi' },
  { title: 'Ex-Yu rap', query: 'ex yu rap' },
  { title: 'Narodna', query: 'narodna muzika' },
  { title: 'Sevdah', query: 'sevdalinke' },
];

export interface FeedShelf {
  key: string;
  title: string;
  tracks: Track[];
  artist?: string;
}

async function cachedSongs(query: string): Promise<Track[]> {
  const key = `songs:${query.toLowerCase()}`;
  const cached = await getCached<Track[]>(key, DAY);
  if (cached) return cached;
  const tracks = await youtube.searchSongs(query);
  await setCached(key, tracks);
  return tracks;
}

function shuffleDaily<T>(items: T[]): T[] {
  // Same order all day, new order tomorrow, so the feed doesn't jump on every visit.
  let seed = Math.floor(Date.now() / DAY);
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Local recommendation: take the most-listened artists (recent plays weigh double), pull their
 * catalogue from YouTube Music, drop songs already heard, and mix them into a daily list.
 */
async function buildFeed(): Promise<FeedShelf[]> {
  const artists = await topArtists(4);
  if (artists.length === 0) {
    const shelves = await Promise.all(
      DISCOVER_QUERIES.map(async (d) => ({ key: d.query, title: d.title, tracks: await cachedSongs(d.query).catch(() => []) })),
    );
    return shelves.filter((s) => s.tracks.length > 0);
  }

  const heard = await playedTrackIds();
  const perArtist = await Promise.all(
    artists.map(async (a) => ({ artist: a.name, tracks: await cachedSongs(a.name).catch(() => [] as Track[]) })),
  );

  const fresh = perArtist.map((p) => p.tracks.filter((t) => !heard.has(t.id)));
  const mix: Track[] = [];
  for (let i = 0; mix.length < 25 && fresh.some((f) => i < f.length); i += 1) {
    fresh.forEach((f) => {
      if (i < f.length) mix.push(f[i]);
    });
  }

  const shelves: FeedShelf[] = [];
  if (mix.length > 0) shelves.push({ key: 'mix', title: 'Made for you', tracks: shuffleDaily(mix) });
  perArtist.slice(0, 3).forEach((p) => {
    if (p.tracks.length > 0) {
      shelves.push({ key: `artist:${p.artist}`, title: `More from ${p.artist}`, tracks: p.tracks, artist: p.artist });
    }
  });
  return shelves;
}

export function useFeed(): { shelves: FeedShelf[]; loading: boolean } {
  // Rebuild when listening history changes enough to matter (bucketed to every 5 plays).
  const playBucket = useDbQuery(
    ['plays'],
    async (db) => Math.floor(((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM plays'))?.n ?? 0) / 5),
    -1,
  );
  const [shelves, setShelves] = useState<FeedShelf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (playBucket < 0) return undefined;
    let cancelled = false;
    setLoading(true);
    buildFeed()
      .then((s) => {
        if (!cancelled) setShelves(s);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [playBucket]);

  return { shelves, loading };
}
