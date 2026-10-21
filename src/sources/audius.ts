import type { Track } from './types';

const API = 'https://api.audius.co/v1';
const APP_NAME = 'e-music';

interface AudiusTrack {
  id: string;
  title: string;
  duration: number;
  user: { name: string };
  artwork: Record<string, string> | null;
  is_streamable?: boolean;
}

/** Full-length streams from Audius; mostly independent and fan uploads, used as a fallback source. */
export async function searchSongs(query: string, limit = 10): Promise<Track[]> {
  const url = `${API}/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}&app_name=${APP_NAME}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audius search failed (${res.status})`);
  const body = (await res.json()) as { data: AudiusTrack[] };
  return body.data
    .filter((t) => t.is_streamable !== false)
    .map((t) => ({
      id: `audius:${t.id}`,
      // The stream endpoint redirects to a signed content-node URL; ExoPlayer follows it.
      url: `${API}/tracks/${t.id}/stream?app_name=${APP_NAME}`,
      title: t.title,
      artist: t.user.name,
      album: null,
      artworkUrl: t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? null,
      durationMs: t.duration * 1000,
      source: 'audius' as const,
    }));
}
