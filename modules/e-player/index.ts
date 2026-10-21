import { NativeModule, requireNativeModule } from 'expo';

export type TrackSource = 'local' | 'youtube' | 'audius';

/** What the player needs to queue a track. Remote tracks use `emusic://<source>/<id>` URLs. */
export interface PlayerTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  album?: string | null;
  artworkUrl?: string | null;
  durationMs?: number | null;
  source: TrackSource;
  /** Collection playback started from (album:<id>, playlist:<id>, liked, artist:<name>). */
  context?: string | null;
}

export type PlaybackState = 'idle' | 'buffering' | 'ready' | 'ended';
export type RepeatMode = 'off' | 'one' | 'all';

export interface PlayerSnapshot {
  state: PlaybackState;
  isPlaying: boolean;
  playWhenReady: boolean;
  index: number;
  trackId: string | null;
  track: PlayerTrack | null;
  queueLength: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  error: { code: string; message: string | null } | null;
}

export interface PlayerFullState extends PlayerSnapshot {
  queue: PlayerTrack[];
}

export interface PlayerProgress {
  positionMs: number;
  bufferedMs: number;
  durationMs: number | null;
}

export interface DeviceInfo {
  manufacturer: string;
  brand: string;
  model: string;
  sdkInt: number;
  hasAutostartScreen: boolean;
}

export interface PlayLogEntry {
  track: PlayerTrack;
  listenedMs: number;
  playedAt: number;
}

export interface OfflineStats {
  recentBytes: number;
  downloadBytes: number;
  limitMb: number;
  pending: number;
}

export interface YtTrackResult extends PlayerTrack {
  kind: 'track';
  artistUrl: string | null;
}

export interface YtArtistResult {
  kind: 'artist';
  id: string;
  name: string;
  artworkUrl: string | null;
}

export interface YtAlbumResult {
  kind: 'album';
  id: string;
  name: string;
  artist: string;
  artworkUrl: string | null;
  trackCount: number;
}

export interface YtAlbum {
  id: string;
  name: string;
  artist: string;
  artworkUrl: string | null;
  tracks: PlayerTrack[];
}

type EPlayerEvents = {
  onStateChange(snapshot: PlayerSnapshot): void;
};

declare class EPlayerNativeModule extends NativeModule<EPlayerEvents> {
  connect(): Promise<PlayerSnapshot>;
  setQueue(tracks: PlayerTrack[], startIndex: number, startPositionMs: number, playNow: boolean): Promise<void>;
  add(tracks: PlayerTrack[], index: number | null): Promise<void>;
  playNext(tracks: PlayerTrack[]): Promise<void>;
  remove(index: number): Promise<void>;
  move(from: number, to: number): Promise<void>;
  clear(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(positionMs: number): Promise<void>;
  skipTo(index: number, positionMs: number): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setRepeatMode(mode: RepeatMode): Promise<void>;
  setShuffle(enabled: boolean): Promise<void>;
  getState(): Promise<PlayerFullState>;
  getProgress(): Promise<PlayerProgress>;

  setSleepTimer(minutes: number, endOfTrack: boolean): Promise<void>;
  setAutoplay(enabled: boolean): Promise<void>;
  drainPlayLog(): Promise<PlayLogEntry[]>;

  offlineDownload(tracks: PlayerTrack[]): Promise<void>;
  offlineRemove(urls: string[]): Promise<void>;
  /** URLs saved on purpose (liked songs). */
  offlineDownloaded(urls: string[]): Promise<string[]>;
  /** URLs playable without network: downloaded or fully in the recent cache. */
  offlineAvailable(urls: string[]): Promise<string[]>;
  offlineStats(): Promise<OfflineStats>;
  offlineClearRecent(): Promise<void>;
  /** Applies from the next app start. */
  offlineSetLimitMb(mb: number): Promise<void>;

  ytSearch(query: string, kind: 'songs'): Promise<YtTrackResult[]>;
  ytSearch(query: string, kind: 'artists'): Promise<YtArtistResult[]>;
  ytSearch(query: string, kind: 'albums'): Promise<YtAlbumResult[]>;
  ytSuggestions(query: string): Promise<string[]>;
  ytAlbum(url: string): Promise<YtAlbum>;
  ytRelated(trackId: string): Promise<PlayerTrack[]>;

  getDeviceInfo(): DeviceInfo;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): Promise<boolean>;
  openAutostartSettings(): Promise<boolean>;
  openAppSettings(): Promise<boolean>;
  queryDeviceAudio(limit: number): Promise<PlayerTrack[]>;
}

export default requireNativeModule<EPlayerNativeModule>('EPlayer');
