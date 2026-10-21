package app.emusic.player

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore

/**
 * Minimal MediaStore listing used to test playback with real files on the phone.
 * The full folder scanner with tag parsing replaces this in the local library step.
 */
object DeviceAudio {
  // Legacy album-art provider; still served by MediaProvider and loadable by image views.
  private const val ALBUM_ART = "content://media/external/audio/albumart"

  fun query(context: Context, limit: Int): List<Map<String, Any?>> {
    val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    val projection = arrayOf(
      MediaStore.Audio.Media._ID,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.ALBUM_ID,
    )
    val result = mutableListOf<Map<String, Any?>>()
    context.contentResolver.query(
      collection,
      projection,
      "${MediaStore.Audio.Media.IS_MUSIC} != 0",
      null,
      "${MediaStore.Audio.Media.DATE_ADDED} DESC",
    )?.use { c ->
      val idCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
      val titleCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
      val artistCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
      val albumCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
      val durationCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
      val albumIdCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
      while (c.moveToNext() && result.size < limit) {
        val id = c.getLong(idCol)
        val artist = c.getString(artistCol)?.takeUnless { it == MediaStore.UNKNOWN_STRING }
        result += mapOf(
          "id" to "local:$id",
          "url" to ContentUris.withAppendedId(collection, id).toString(),
          "title" to (c.getString(titleCol) ?: ""),
          "artist" to (artist ?: ""),
          "album" to c.getString(albumCol),
          "artworkUrl" to "$ALBUM_ART/${c.getLong(albumIdCol)}",
          "durationMs" to c.getLong(durationCol).toDouble(),
          "source" to "local",
        )
      }
    }
    return result
  }
}
