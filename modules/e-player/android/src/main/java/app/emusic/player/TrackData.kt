package app.emusic.player

import android.net.Uri
import android.os.Bundle
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi

/** The one track shape shared by the JS bridge, the YouTube source and the play log. */
data class TrackData(
  val id: String,
  val url: String,
  val title: String,
  val artist: String,
  val album: String? = null,
  val artworkUrl: String? = null,
  val durationMs: Long? = null,
  val source: String,
  /** Where playback started from (album:<id>, playlist:<id>, liked, artist:<name>); null for single plays. */
  val context: String? = null,
) {
  @OptIn(UnstableApi::class)
  fun toMediaItem(): MediaItem {
    val uri = Uri.parse(url)
    val metadata = MediaMetadata.Builder()
      .setTitle(title)
      .setArtist(artist)
      .setAlbumTitle(album)
      .setArtworkUri(artworkUrl?.let(Uri::parse))
      .setDurationMs(durationMs)
      .setIsPlayable(true)
      .setIsBrowsable(false)
      .setExtras(
        Bundle().apply {
          putString(EXTRA_SOURCE, source)
          putString(EXTRA_CONTEXT, context)
        },
      )
      .build()
    return MediaItem.Builder()
      .setMediaId(id)
      .setUri(uri)
      .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(uri).build())
      .setMediaMetadata(metadata)
      .build()
  }

  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "url" to url,
    "title" to title,
    "artist" to artist,
    "album" to album,
    "artworkUrl" to artworkUrl,
    "durationMs" to durationMs?.toDouble(),
    "source" to source,
    "context" to context,
  )

  companion object {
    const val EXTRA_SOURCE = "source"
    const val EXTRA_CONTEXT = "context"

    @OptIn(UnstableApi::class)
    fun from(item: MediaItem): TrackData {
      val m = item.mediaMetadata
      return TrackData(
        id = item.mediaId,
        url = (item.requestMetadata.mediaUri ?: item.localConfiguration?.uri)?.toString() ?: "",
        title = m.title?.toString() ?: "",
        artist = m.artist?.toString() ?: "",
        album = m.albumTitle?.toString(),
        artworkUrl = m.artworkUri?.toString(),
        durationMs = m.durationMs,
        source = m.extras?.getString(EXTRA_SOURCE) ?: "local",
        context = m.extras?.getString(EXTRA_CONTEXT),
      )
    }
  }
}
