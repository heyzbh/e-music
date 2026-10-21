package app.emusic.player

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.TransferListener
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.ContentMetadata
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.NoOpCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import app.emusic.player.youtube.YouTube
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Offline audio, in two caches keyed by the track URL (`emusic://youtube/<id>` or the Audius
 * stream URL), so a cached song plays without resolving a fresh stream URL or any network:
 *
 * - "recent": everything you stream is written here, oldest evicted past the size limit.
 * - "downloads": liked songs saved on purpose, never evicted, removed on unlike.
 *
 * Playback reads downloads first, then recent, then the network. Local files bypass both.
 * One process-wide instance: SimpleCache locks its folder.
 */
@OptIn(UnstableApi::class)
object OfflineStore {
  private const val PREFS = "emusic"
  private const val PREF_CACHE_MB = "cacheMb"
  private const val DEFAULT_CACHE_MB = 1024L
  private const val USER_AGENT = "e-music/0.3 (Android)"

  private var recent: SimpleCache? = null
  private var downloads: SimpleCache? = null
  private val downloader = Executors.newSingleThreadExecutor()
  private val pending = ConcurrentHashMap.newKeySet<String>()

  @Synchronized
  private fun init(context: Context) {
    if (recent != null) return
    val app = context.applicationContext
    StreamResolvers.register(YouTube.SOURCE) { id -> YouTube.resolveStream(id) }
    val db = StandaloneDatabaseProvider(app)
    val limitMb = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(PREF_CACHE_MB, DEFAULT_CACHE_MB)
    recent = SimpleCache(File(app.filesDir, "audio-cache"), LeastRecentlyUsedCacheEvictor(limitMb * 1024 * 1024), db)
    downloads = SimpleCache(File(app.filesDir, "audio-downloads"), NoOpCacheEvictor(), db)
  }

  private fun recent(context: Context): SimpleCache {
    init(context)
    return recent!!
  }

  private fun downloads(context: Context): SimpleCache {
    init(context)
    return downloads!!
  }

  /** Network source that turns `emusic://` URLs into real stream URLs at load time. */
  private fun networkFactory(): DataSource.Factory {
    val http = DefaultHttpDataSource.Factory()
      .setUserAgent(USER_AGENT)
      .setAllowCrossProtocolRedirects(true)
      .setConnectTimeoutMs(15_000)
      .setReadTimeoutMs(20_000)
    return ResolvingDataSource.Factory(http) { spec ->
      if (spec.uri.scheme == StreamResolvers.SCHEME) {
        val resolved = StreamResolvers.resolve(spec.uri)
        spec.withUri(resolved.uri).withAdditionalHeaders(resolved.headers)
      } else {
        spec
      }
    }
  }

  /** The data source the player uses for every track. */
  fun playbackFactory(context: Context): DataSource.Factory {
    val throughRecent = CacheDataSource.Factory()
      .setCache(recent(context))
      .setUpstreamDataSourceFactory(networkFactory())
      .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    // Downloads are read-only here; only explicit downloads write to that cache.
    val remote = CacheDataSource.Factory()
      .setCache(downloads(context))
      .setUpstreamDataSourceFactory(throughRecent)
      .setCacheWriteDataSinkFactory(null)
      .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    val local = DefaultDataSource.Factory(context.applicationContext)
    return DataSource.Factory { RoutingDataSource(remote.createDataSource(), local.createDataSource()) }
  }

  fun isRemote(url: String): Boolean {
    val scheme = Uri.parse(url).scheme
    return scheme == "http" || scheme == "https" || scheme == StreamResolvers.SCHEME
  }

  /** Saves tracks for offline use, one at a time in the background. Already saved ones are skipped. */
  fun download(context: Context, tracks: List<TrackData>) {
    val cache = downloads(context)
    tracks.filter { isRemote(it.url) && !isComplete(cache, it.url) && pending.add(it.url) }.forEach { track ->
      downloader.execute {
        try {
          val source = CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(networkFactory())
            .createDataSource()
          CacheWriter(source, DataSpec(Uri.parse(track.url)), null, null).cache()
        } catch (_: Exception) {
          // Network gone or stream unavailable; the next sync retries.
        } finally {
          pending.remove(track.url)
        }
      }
    }
  }

  fun remove(context: Context, urls: List<String>) {
    val cache = downloads(context)
    urls.forEach { url ->
      pending.remove(url)
      runCatching { cache.removeResource(url) }
    }
  }

  /** The subset of `urls` that is fully saved, in either cache. */
  fun available(context: Context, urls: List<String>): List<String> {
    val d = downloads(context)
    val r = recent(context)
    return urls.filter { isComplete(d, it) || isComplete(r, it) }
  }

  fun downloaded(context: Context, urls: List<String>): List<String> {
    val d = downloads(context)
    return urls.filter { isComplete(d, it) }
  }

  fun stats(context: Context): Map<String, Any?> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return mapOf(
      "recentBytes" to recent(context).cacheSpace.toDouble(),
      "downloadBytes" to downloads(context).cacheSpace.toDouble(),
      "limitMb" to prefs.getLong(PREF_CACHE_MB, DEFAULT_CACHE_MB).toDouble(),
      "pending" to pending.size,
    )
  }

  fun clearRecent(context: Context) {
    val cache = recent(context)
    cache.keys.toList().forEach { runCatching { cache.removeResource(it) } }
  }

  /** The evictor is fixed per cache instance, so a new limit applies from the next app start. */
  fun setLimitMb(context: Context, mb: Long) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(PREF_CACHE_MB, mb).apply()
  }

  private fun isComplete(cache: SimpleCache, key: String): Boolean {
    val length = ContentMetadata.getContentLength(cache.getContentMetadata(key))
    return length > 0 && cache.isCached(key, 0, length)
  }

  /** Sends remote URLs through the caches and local files (content://, file://) straight to disk. */
  private class RoutingDataSource(private val remote: DataSource, private val local: DataSource) : DataSource {
    private var active: DataSource? = null

    override fun addTransferListener(transferListener: TransferListener) {
      remote.addTransferListener(transferListener)
      local.addTransferListener(transferListener)
    }

    override fun open(dataSpec: DataSpec): Long {
      val source = if (isRemote(dataSpec.uri.toString())) remote else local
      active = source
      return source.open(dataSpec)
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int =
      active?.read(buffer, offset, length) ?: throw IllegalStateException("Not opened")

    override fun getUri(): Uri? = active?.uri

    override fun getResponseHeaders(): Map<String, List<String>> = active?.responseHeaders ?: emptyMap()

    override fun close() {
      try {
        active?.close()
      } finally {
        active = null
      }
    }
  }
}
