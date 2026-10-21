package app.emusic.player.youtube

import android.net.Uri
import app.emusic.player.ResolvedStream
import app.emusic.player.TrackData
import org.schabi.newpipe.extractor.Image
import org.schabi.newpipe.extractor.InfoItem
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.channel.ChannelInfoItem
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization
import org.schabi.newpipe.extractor.playlist.PlaylistInfo
import org.schabi.newpipe.extractor.playlist.PlaylistInfoItem
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.stream.DeliveryMethod
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

/**
 * YouTube Music through NewPipeExtractor. All calls block on network and must run off the
 * main thread. Results are shaped as plain maps for the JS bridge.
 */
object YouTube {
  const val SOURCE = "youtube"
  private const val ID_PREFIX = "yt:"
  private const val EXPIRY_MARGIN_MS = 10 * 60 * 1000L
  private const val DEFAULT_TTL_MS = 5 * 60 * 60 * 1000L

  private val service get() = ServiceList.YouTube
  @Volatile private var initialized = false

  private class CachedStream(val stream: ResolvedStream, val expiresAt: Long, val related: List<TrackData>)
  private val streamCache = ConcurrentHashMap<String, CachedStream>()

  private fun ensureInit() {
    if (initialized) return
    synchronized(this) {
      if (!initialized) {
        NewPipe.init(HttpDownloader, Localization("en", "BA"), ContentCountry("BA"))
        initialized = true
      }
    }
  }

  fun trackId(videoId: String) = "$ID_PREFIX$videoId"
  fun videoIdOf(trackId: String): String? = trackId.takeIf { it.startsWith(ID_PREFIX) }?.removePrefix(ID_PREFIX)

  fun search(query: String, kind: String): List<Map<String, Any?>> {
    ensureInit()
    val filter = when (kind) {
      "artists" -> "music_artists"
      "albums" -> "music_albums"
      "videos" -> "videos"
      else -> "music_songs"
    }
    val handler = service.searchQHFactory.fromQuery(query, listOf(filter), "")
    return SearchInfo.getInfo(service, handler).relatedItems.mapNotNull(::toResult)
  }

  fun suggestions(query: String): List<String> {
    ensureInit()
    return service.suggestionExtractor.suggestionList(query)
  }

  fun album(url: String): Map<String, Any?> {
    ensureInit()
    val info = PlaylistInfo.getInfo(service, url)
    val tracks = info.relatedItems.filterIsInstance<StreamInfoItem>().mapNotNull(::toTrack)
    val artist = cleanArtist(info.uploaderName).ifEmpty { tracks.firstOrNull()?.artist ?: "" }
    val artwork = bestImage(info.thumbnails)
    return mapOf(
      "id" to url,
      "name" to cleanAlbum(info.name),
      "artist" to artist,
      "artworkUrl" to artwork,
      // Album tracks carry video thumbnails; the album cover looks better on every row.
      "tracks" to tracks.map { t ->
        t.copy(album = cleanAlbum(info.name), artworkUrl = artwork ?: t.artworkUrl).toMap()
      },
    )
  }

  /** Songs YouTube considers related; used for autoplay when the queue runs out. */
  fun related(videoId: String): List<TrackData> {
    streamCache[videoId]?.let { if (it.related.isNotEmpty()) return it.related }
    ensureInit()
    return relatedOf(StreamInfo.getInfo(service, watchUrl(videoId)))
  }

  /** Drops a cached stream URL, e.g. after a 403 because the phone's IP address changed. */
  fun evict(videoId: String) {
    streamCache.remove(videoId)
  }

  fun resolveStream(videoId: String): ResolvedStream {
    streamCache[videoId]?.let { if (it.expiresAt > System.currentTimeMillis()) return it.stream }
    ensureInit()
    val info = StreamInfo.getInfo(service, watchUrl(videoId))
    val best = info.audioStreams
      .filter { it.deliveryMethod == DeliveryMethod.PROGRESSIVE_HTTP && it.isUrl }
      .maxByOrNull { it.averageBitrate }
      ?: throw IOException("No playable audio stream for $videoId")

    val url = best.content
    val expireSec = Uri.parse(url).getQueryParameter("expire")?.toLongOrNull()
    val expiresAt = (expireSec?.times(1000) ?: (System.currentTimeMillis() + DEFAULT_TTL_MS)) - EXPIRY_MARGIN_MS
    val stream = ResolvedStream(Uri.parse(url))
    streamCache[videoId] = CachedStream(stream, expiresAt, relatedOf(info))
    return stream
  }

  private fun relatedOf(info: StreamInfo): List<TrackData> =
    info.relatedItems
      .filterIsInstance<StreamInfoItem>()
      // Skip hour-long mixes and shorts.
      .filter { it.duration in 60..900 }
      .mapNotNull(::toTrack)

  private fun watchUrl(videoId: String) = "https://music.youtube.com/watch?v=$videoId"

  private fun toResult(item: InfoItem): Map<String, Any?>? = when (item) {
    is StreamInfoItem -> toTrack(item)?.toMap()?.plus(
      mapOf("kind" to "track", "artistUrl" to item.uploaderUrl),
    )
    is ChannelInfoItem -> mapOf(
      "kind" to "artist",
      "id" to item.url,
      "name" to cleanArtist(item.name),
      "artworkUrl" to bestImage(item.thumbnails),
    )
    is PlaylistInfoItem -> mapOf(
      "kind" to "album",
      "id" to item.url,
      "name" to cleanAlbum(item.name),
      "artist" to cleanArtist(item.uploaderName),
      "artworkUrl" to bestImage(item.thumbnails),
      "trackCount" to item.streamCount.toDouble(),
    )
    else -> null
  }

  private fun toTrack(item: StreamInfoItem): TrackData? {
    val videoId = runCatching { service.streamLHFactory.getId(item.url) }.getOrNull() ?: return null
    return TrackData(
      id = trackId(videoId),
      url = "emusic://$SOURCE/$videoId",
      title = item.name,
      artist = cleanArtist(item.uploaderName),
      artworkUrl = bestImage(item.thumbnails),
      durationMs = item.duration.takeIf { it > 0 }?.times(1000),
      source = SOURCE,
    )
  }

  private val googleSizeSuffix = Regex("=w\\d+-h\\d+.*$")

  private fun bestImage(images: List<Image>): String? {
    val url = images.maxByOrNull { maxOf(it.height, it.width) }?.url ?: return null
    // YouTube Music art comes from lh3.googleusercontent.com and can be requested at any size.
    return if (googleSizeSuffix.containsMatchIn(url)) url.replace(googleSizeSuffix, "=w544-h544-l90-rj") else url
  }

  private fun cleanArtist(name: String?): String = (name ?: "").removeSuffix(" - Topic").trim()

  private val albumPrefix = Regex("^(Album|Single|EP)\\s*[–-]\\s*")
  private fun cleanAlbum(name: String?): String = (name ?: "").replace(albumPrefix, "").trim()
}
