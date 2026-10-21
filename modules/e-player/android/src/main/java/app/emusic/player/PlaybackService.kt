package app.emusic.player

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import app.emusic.player.youtube.YouTube
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import java.util.concurrent.Executors

/**
 * Owns the player. Media3 promotes this service to a foreground service with a media
 * notification while playing, and routes lock screen, Bluetooth and headset buttons to it.
 * Autoplay, play logging and the sleep timer also live here, so they keep working after the
 * React Native side has been torn down.
 */
@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {
  private var session: MediaSession? = null
  private lateinit var player: ExoPlayer
  private val main = Handler(Looper.getMainLooper())
  private val background = Executors.newSingleThreadExecutor()

  // Listening time of the current item, for the play log.
  private var trackedItem: MediaItem? = null
  private var trackedStartedAt = 0L
  private var playingSince: Long? = null
  private var listenedMs = 0L

  private var autoplayInFlight = false
  private val retriedIds = mutableSetOf<String>()
  private var consecutiveSkips = 0
  private var sleepRunnable: Runnable? = null

  override fun onCreate() {
    super.onCreate()
    player = ExoPlayer.Builder(this)
      // Caches first (offline and recently played), then the network; see OfflineStore.
      .setMediaSourceFactory(DefaultMediaSourceFactory(OfflineStore.playbackFactory(this)))
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
          .build(),
        /* handleAudioFocus = */ true,
      )
      .setHandleAudioBecomingNoisy(true)
      .setWakeMode(C.WAKE_MODE_NETWORK)
      .build()
    player.addListener(PlayerEvents())

    val builder = MediaSession.Builder(this, player).setCallback(SessionCallback())
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      launch.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      builder.setSessionActivity(
        PendingIntent.getActivity(
          this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        ),
      )
    }
    session = builder.build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

  /** Swiping the app away keeps music going; if nothing is playing, shut down cleanly. */
  override fun onTaskRemoved(rootIntent: Intent?) {
    if (!player.playWhenReady || player.mediaItemCount == 0) {
      stopSelf()
    }
  }

  override fun onDestroy() {
    flushPlay()
    cancelSleep()
    background.shutdownNow()
    session?.run {
      player.release()
      release()
    }
    session = null
    super.onDestroy()
  }

  // Play log

  private fun flushPlay() {
    val item = trackedItem ?: return
    playingSince?.let { listenedMs += SystemClock.elapsedRealtime() - it }
    playingSince = if (player.isPlaying) SystemClock.elapsedRealtime() else null
    if (listenedMs >= MIN_LOGGED_MS) {
      PlayLog.append(this, TrackData.from(item), listenedMs, trackedStartedAt)
    }
    listenedMs = 0
  }

  // Autoplay: when the last track starts, append related songs so the music never stops.

  private fun autoplayEnabled() = prefs().getBoolean(PREF_AUTOPLAY, true)

  private fun maybeAutoplay() {
    if (autoplayInFlight || !autoplayEnabled()) return
    if (player.repeatMode != Player.REPEAT_MODE_OFF || player.mediaItemCount == 0) return
    if (player.currentMediaItemIndex < player.mediaItemCount - 1) return
    val seed = TrackData.from(player.currentMediaItem ?: return)

    autoplayInFlight = true
    background.execute {
      val related = runCatching {
        val videoId = YouTube.videoIdOf(seed.id)
        when {
          videoId != null -> YouTube.related(videoId)
          seed.artist.isNotBlank() -> YouTube.search(seed.artist, "songs").mapNotNull(::trackFromMap)
          else -> emptyList()
        }
      }.getOrDefault(emptyList())

      main.post {
        autoplayInFlight = false
        val queued = (0 until player.mediaItemCount).map { player.getMediaItemAt(it).mediaId }.toSet()
        val fresh = related.filter { it.id !in queued }.distinctBy { it.id }.take(AUTOPLAY_BATCH)
        if (fresh.isNotEmpty()) player.addMediaItems(fresh.map { it.toMediaItem() })
      }
    }
  }

  // Sleep timer

  private fun cancelSleep() {
    sleepRunnable?.let(main::removeCallbacks)
    sleepRunnable = null
    main.removeCallbacksAndMessages(FADE_TOKEN)
    player.volume = 1f
    player.pauseAtEndOfMediaItems = false
  }

  private fun startSleep(minutes: Int, endOfTrack: Boolean) {
    cancelSleep()
    if (endOfTrack) {
      player.pauseAtEndOfMediaItems = true
      return
    }
    if (minutes <= 0) return
    val runnable = Runnable { fadeOutAndPause() }
    sleepRunnable = runnable
    main.postDelayed(runnable, minutes * 60_000L)
  }

  private fun fadeOutAndPause() {
    val steps = 20
    for (i in 1..steps) {
      main.postAtTime({
        if (i == steps) {
          player.pause()
          player.volume = 1f
          sleepRunnable = null
        } else {
          player.volume = 1f - i.toFloat() / steps
        }
      }, FADE_TOKEN, SystemClock.uptimeMillis() + i * FADE_STEP_MS)
    }
  }

  private fun prefs() = getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private inner class PlayerEvents : Player.Listener {
    override fun onIsPlayingChanged(isPlaying: Boolean) {
      val now = SystemClock.elapsedRealtime()
      if (isPlaying) {
        playingSince = now
      } else {
        playingSince?.let { listenedMs += now - it }
        playingSince = null
      }
    }

    // YouTube stream URLs are bound to the IP they were issued for. Switching between Wi-Fi
    // and mobile data makes the cached URL fail, so fetch a fresh one and resume once.
    // Without network (tunnels, dead zones) songs that are not saved offline cannot load;
    // skip ahead so a saved song further in the queue can play.
    override fun onPlayerError(error: PlaybackException) {
      val item = player.currentMediaItem ?: return
      val videoId = YouTube.videoIdOf(item.mediaId)
      if (videoId != null && retriedIds.add(item.mediaId)) {
        YouTube.evict(videoId)
        player.prepare()
        player.play()
        return
      }
      if (consecutiveSkips < MAX_ERROR_SKIPS && player.hasNextMediaItem()) {
        consecutiveSkips += 1
        player.seekToNextMediaItem()
        player.prepare()
        player.play()
      }
    }

    override fun onPlaybackStateChanged(playbackState: Int) {
      if (playbackState == Player.STATE_READY) {
        retriedIds.clear()
        consecutiveSkips = 0
      }
    }

    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
      flushPlay()
      trackedItem = mediaItem
      trackedStartedAt = System.currentTimeMillis()
      // "End of track" sleep: the first finished item ends the timer.
      if (player.pauseAtEndOfMediaItems && reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO) {
        player.pauseAtEndOfMediaItems = false
      }
      maybeAutoplay()
    }

    override fun onTimelineChanged(timeline: androidx.media3.common.Timeline, reason: Int) {
      if (reason == Player.TIMELINE_CHANGE_REASON_PLAYLIST_CHANGED) maybeAutoplay()
    }
  }

  private inner class SessionCallback : MediaSession.Callback {
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
    ): MediaSession.ConnectionResult {
      if (controller.packageName != packageName) {
        return MediaSession.ConnectionResult.AcceptedResultBuilder(session).build()
      }
      val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
        .add(SessionCommand(CMD_SLEEP, Bundle.EMPTY))
        .add(SessionCommand(CMD_AUTOPLAY, Bundle.EMPTY))
        .build()
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
        .setAvailableSessionCommands(commands)
        .build()
    }

    override fun onCustomCommand(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
      customCommand: SessionCommand,
      args: Bundle,
    ): ListenableFuture<SessionResult> {
      when (customCommand.customAction) {
        CMD_SLEEP -> startSleep(args.getInt(ARG_MINUTES), args.getBoolean(ARG_END_OF_TRACK))
        CMD_AUTOPLAY -> {
          prefs().edit().putBoolean(PREF_AUTOPLAY, args.getBoolean(ARG_ENABLED, true)).apply()
          maybeAutoplay()
        }
        else -> return super.onCustomCommand(session, controller, customCommand, args)
      }
      return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
    }

    // Items arriving through a MediaController may lose their local URI on the way in,
    // so rebuild it from requestMetadata, which always survives.
    override fun onAddMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
    ): ListenableFuture<MutableList<MediaItem>> {
      val playable = mediaItems.map { item ->
        val uri = item.localConfiguration?.uri ?: item.requestMetadata.mediaUri
        if (uri == null) item else item.buildUpon().setUri(uri).build()
      }
      return Futures.immediateFuture(playable.toMutableList())
    }
  }

  companion object {
    const val CMD_SLEEP = "emusic.SLEEP"
    const val CMD_AUTOPLAY = "emusic.AUTOPLAY"
    const val ARG_MINUTES = "minutes"
    const val ARG_END_OF_TRACK = "endOfTrack"
    const val ARG_ENABLED = "enabled"

    private const val PREFS = "emusic"
    private const val PREF_AUTOPLAY = "autoplay"
    private const val MIN_LOGGED_MS = 5_000L
    private const val AUTOPLAY_BATCH = 10
    private const val FADE_STEP_MS = 500L
    private const val MAX_ERROR_SKIPS = 5
    private val FADE_TOKEN = Any()

    internal fun trackFromMap(map: Map<String, Any?>): TrackData? {
      return TrackData(
        id = map["id"] as? String ?: return null,
        url = map["url"] as? String ?: return null,
        title = map["title"] as? String ?: "",
        artist = map["artist"] as? String ?: "",
        album = map["album"] as? String,
        artworkUrl = map["artworkUrl"] as? String,
        durationMs = (map["durationMs"] as? Double)?.toLong(),
        source = map["source"] as? String ?: "local",
      )
    }
  }
}
