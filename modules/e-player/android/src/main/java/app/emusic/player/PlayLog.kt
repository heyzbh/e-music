package app.emusic.player

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Listening history written by the service, so plays are recorded even while the JS side is
 * not running (screen off, app swiped away). JS drains it into SQLite on startup and on
 * track changes.
 */
object PlayLog {
  private const val FILE = "play-log.jsonl"
  private val lock = Any()

  fun append(context: Context, track: TrackData, listenedMs: Long, playedAt: Long) {
    val line = JSONObject()
      .put("track", JSONObject(track.toMap()))
      .put("listenedMs", listenedMs)
      .put("playedAt", playedAt)
      .toString()
    synchronized(lock) {
      File(context.filesDir, FILE).appendText(line + "\n")
    }
  }

  fun drain(context: Context): List<Map<String, Any?>> {
    val lines = synchronized(lock) {
      val file = File(context.filesDir, FILE)
      if (!file.exists()) return emptyList()
      val text = file.readText()
      file.delete()
      text.lines().filter { it.isNotBlank() }
    }
    return lines.mapNotNull { line ->
      runCatching {
        val json = JSONObject(line)
        val t = json.getJSONObject("track")
        mapOf(
          "track" to t.keys().asSequence().associateWith { key -> t.opt(key)?.takeUnless { it == JSONObject.NULL } },
          "listenedMs" to json.getLong("listenedMs").toDouble(),
          "playedAt" to json.getLong("playedAt").toDouble(),
        )
      }.getOrNull()
    }
  }
}
