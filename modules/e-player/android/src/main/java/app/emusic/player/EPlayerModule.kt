package app.emusic.player

import android.content.ComponentName
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import app.emusic.player.youtube.YouTube
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class TrackInput : Record {
  @Field val id: String = ""
  @Field val url: String = ""
  @Field val title: String = ""
  @Field val artist: String = ""
  @Field val album: String? = null
  @Field val artworkUrl: String? = null
  @Field val durationMs: Double? = null
  @Field val source: String = "local"
  @Field val context: String? = null

  fun toData() = TrackData(id, url, title, artist, album, artworkUrl, durationMs?.toLong(), source, context)
}

/**
 * JS bridge to [PlaybackService]. It only holds a MediaController; the player itself lives
 * in the service, so playback is unaffected when the JS runtime goes away.
 * All player calls run on the main thread, which is the controller's application looper.
 */
class EPlayerModule : Module() {
  private var controller: MediaController? = null
  private var controllerFuture: ListenableFuture<MediaController>? = null

  private val listener = object : Player.Listener {
    override fun onEvents(player: Player, events: Player.Events) {
      sendEvent(EVENT_STATE, snapshot(player))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("EPlayer")

    Events(EVENT_STATE)

    OnDestroy {
      val future = controllerFuture ?: return@OnDestroy
      Handler(Looper.getMainLooper()).post {
        controller?.removeListener(listener)
        MediaController.releaseFuture(future)
      }
      controller = null
      controllerFuture = null
    }

    AsyncFunction("connect") { promise: Promise ->
      withController(promise) { snapshot(it) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setQueue") { tracks: List<TrackInput>, startIndex: Int, startPositionMs: Double, playNow: Boolean, promise: Promise ->
      withController(promise) { c ->
        c.setMediaItems(tracks.map { it.toData().toMediaItem() }, startIndex, startPositionMs.toLong())
        c.prepare()
        if (playNow) c.play()
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("add") { tracks: List<TrackInput>, index: Int?, promise: Promise ->
      withController(promise) { c ->
        val items = tracks.map { it.toData().toMediaItem() }
        if (index == null) c.addMediaItems(items) else c.addMediaItems(index, items)
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("playNext") { tracks: List<TrackInput>, promise: Promise ->
      withController(promise) { c ->
        val at = if (c.mediaItemCount == 0) 0 else c.currentMediaItemIndex + 1
        c.addMediaItems(at, tracks.map { it.toData().toMediaItem() })
        if (c.playbackState == Player.STATE_IDLE) c.prepare()
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("remove") { index: Int, promise: Promise ->
      withController(promise) { it.removeMediaItem(index); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("move") { from: Int, to: Int, promise: Promise ->
      withController(promise) { it.moveMediaItem(from, to); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("clear") { promise: Promise ->
      withController(promise) { it.clearMediaItems(); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") { promise: Promise ->
      withController(promise) { c ->
        when (c.playbackState) {
          Player.STATE_IDLE -> c.prepare()
          Player.STATE_ENDED -> c.seekToDefaultPosition(0)
          else -> Unit
        }
        c.play()
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { promise: Promise ->
      withController(promise) { it.pause(); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("seekTo") { positionMs: Double, promise: Promise ->
      withController(promise) { it.seekTo(positionMs.toLong()); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("skipTo") { index: Int, positionMs: Double, promise: Promise ->
      withController(promise) { it.seekTo(index, positionMs.toLong()); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("next") { promise: Promise ->
      withController(promise) { it.seekToNext(); null }
    }.runOnQueue(Queues.MAIN)

    // Restarts the current track when more than ~3s in, like every other player.
    AsyncFunction("previous") { promise: Promise ->
      withController(promise) { it.seekToPrevious(); null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setRepeatMode") { mode: String, promise: Promise ->
      withController(promise) { c ->
        c.repeatMode = when (mode) {
          "one" -> Player.REPEAT_MODE_ONE
          "all" -> Player.REPEAT_MODE_ALL
          else -> Player.REPEAT_MODE_OFF
        }
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setShuffle") { enabled: Boolean, promise: Promise ->
      withController(promise) { it.shuffleModeEnabled = enabled; null }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getState") { promise: Promise ->
      withController(promise) { c ->
        snapshot(c) + ("queue" to (0 until c.mediaItemCount).map { TrackData.from(c.getMediaItemAt(it)).toMap() })
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getProgress") { promise: Promise ->
      withController(promise) { c ->
        mapOf(
          "positionMs" to c.currentPosition.toDouble(),
          "bufferedMs" to c.bufferedPosition.toDouble(),
          "durationMs" to c.duration.takeIf { it != C.TIME_UNSET }?.toDouble(),
        )
      }
    }.runOnQueue(Queues.MAIN)

    // minutes = 0 cancels; endOfTrack pauses when the current song finishes.
    AsyncFunction("setSleepTimer") { minutes: Int, endOfTrack: Boolean, promise: Promise ->
      withController(promise) { c ->
        val args = Bundle().apply {
          putInt(PlaybackService.ARG_MINUTES, minutes)
          putBoolean(PlaybackService.ARG_END_OF_TRACK, endOfTrack)
        }
        c.sendCustomCommand(SessionCommand(PlaybackService.CMD_SLEEP, Bundle.EMPTY), args)
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setAutoplay") { enabled: Boolean, promise: Promise ->
      withController(promise) { c ->
        val args = Bundle().apply { putBoolean(PlaybackService.ARG_ENABLED, enabled) }
        c.sendCustomCommand(SessionCommand(PlaybackService.CMD_AUTOPLAY, Bundle.EMPTY), args)
        null
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("drainPlayLog") {
      val context = appContext.reactContext
      if (context == null) emptyList<Map<String, Any?>>() else PlayLog.drain(context)
    }

    // Offline

    AsyncFunction("offlineDownload") { tracks: List<TrackInput> ->
      appContext.reactContext?.let { OfflineStore.download(it, tracks.map(TrackInput::toData)) }
      Unit
    }

    AsyncFunction("offlineRemove") Coroutine { urls: List<String> ->
      withContext(Dispatchers.IO) { appContext.reactContext?.let { OfflineStore.remove(it, urls) } }
      Unit
    }

    AsyncFunction("offlineDownloaded") Coroutine { urls: List<String> ->
      withContext(Dispatchers.IO) {
        val context = appContext.reactContext
        if (context == null) emptyList() else OfflineStore.downloaded(context, urls)
      }
    }

    AsyncFunction("offlineAvailable") Coroutine { urls: List<String> ->
      withContext(Dispatchers.IO) {
        val context = appContext.reactContext
        if (context == null) emptyList() else OfflineStore.available(context, urls)
      }
    }

    AsyncFunction("offlineStats") Coroutine { ->
      withContext(Dispatchers.IO) {
        val context = appContext.reactContext
        if (context == null) emptyMap<String, Any?>() else OfflineStore.stats(context)
      }
    }

    AsyncFunction("offlineClearRecent") Coroutine { ->
      withContext(Dispatchers.IO) { appContext.reactContext?.let(OfflineStore::clearRecent) }
      Unit
    }

    AsyncFunction("offlineSetLimitMb") { mb: Int ->
      appContext.reactContext?.let { OfflineStore.setLimitMb(it, mb.toLong()) }
      Unit
    }

    // YouTube Music

    AsyncFunction("ytSearch") Coroutine { query: String, kind: String ->
      withContext(Dispatchers.IO) { YouTube.search(query, kind) }
    }

    AsyncFunction("ytSuggestions") Coroutine { query: String ->
      withContext(Dispatchers.IO) { YouTube.suggestions(query) }
    }

    AsyncFunction("ytAlbum") Coroutine { url: String ->
      withContext(Dispatchers.IO) { YouTube.album(url) }
    }

    AsyncFunction("ytRelated") Coroutine { trackId: String ->
      withContext(Dispatchers.IO) {
        val videoId = YouTube.videoIdOf(trackId)
        if (videoId == null) emptyList<Map<String, Any?>>() else YouTube.related(videoId).map { it.toMap() }
      }
    }

    // Power management and device helpers.

    Function("getDeviceInfo") { PowerHelper.deviceInfo() }

    Function("isIgnoringBatteryOptimizations") {
      appContext.reactContext?.let(PowerHelper::isIgnoringBatteryOptimizations) ?: false
    }

    AsyncFunction("requestIgnoreBatteryOptimizations") {
      appContext.reactContext?.let(PowerHelper::requestIgnoreBatteryOptimizations) ?: false
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openAutostartSettings") {
      appContext.reactContext?.let(PowerHelper::openAutostartSettings) ?: false
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openAppSettings") {
      appContext.reactContext?.let(PowerHelper::openAppSettings) ?: false
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("queryDeviceAudio") { limit: Int ->
      val context = appContext.reactContext
      if (context == null) emptyList<Map<String, Any?>>() else DeviceAudio.query(context, limit)
    }
  }

  private fun withController(promise: Promise, block: (MediaController) -> Any?) {
    controller?.let { existing ->
      if (existing.isConnected) {
        run(existing, promise, block)
        return
      }
      // The service died (e.g. killed by the OS); reconnecting restarts it.
      existing.removeListener(listener)
      existing.release()
      controller = null
      controllerFuture = null
    }

    val context = appContext.reactContext
    if (context == null) {
      promise.reject("E_NO_CONTEXT", "React context is not available", null)
      return
    }
    val future = controllerFuture ?: MediaController.Builder(
      context,
      SessionToken(context, ComponentName(context, PlaybackService::class.java)),
    ).buildAsync().also { controllerFuture = it }

    future.addListener({
      try {
        val connected = future.get()
        if (controller !== connected) {
          controller = connected
          connected.addListener(listener)
        }
        run(connected, promise, block)
      } catch (e: Exception) {
        controllerFuture = null
        promise.reject("E_CONNECT", "Could not connect to playback service: ${e.message}", e)
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun run(c: MediaController, promise: Promise, block: (MediaController) -> Any?) {
    try {
      promise.resolve(block(c))
    } catch (e: Exception) {
      promise.reject("E_PLAYER", e.message, e)
    }
  }

  private fun snapshot(p: Player): Map<String, Any?> = mapOf(
    "state" to when (p.playbackState) {
      Player.STATE_BUFFERING -> "buffering"
      Player.STATE_READY -> "ready"
      Player.STATE_ENDED -> "ended"
      else -> "idle"
    },
    "isPlaying" to p.isPlaying,
    "playWhenReady" to p.playWhenReady,
    "index" to if (p.mediaItemCount == 0) -1 else p.currentMediaItemIndex,
    "trackId" to p.currentMediaItem?.mediaId,
    "track" to p.currentMediaItem?.let { TrackData.from(it).toMap() },
    "queueLength" to p.mediaItemCount,
    "repeatMode" to when (p.repeatMode) {
      Player.REPEAT_MODE_ONE -> "one"
      Player.REPEAT_MODE_ALL -> "all"
      else -> "off"
    },
    "shuffle" to p.shuffleModeEnabled,
    "error" to p.playerError?.let { mapOf("code" to it.errorCodeName, "message" to it.message) },
  )

  companion object {
    private const val EVENT_STATE = "onStateChange"
  }
}
