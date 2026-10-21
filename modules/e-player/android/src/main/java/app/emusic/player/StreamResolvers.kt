package app.emusic.player

import android.net.Uri
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

/**
 * Tracks from remote sources are queued as `emusic://<source>/<id>` and turned into a real
 * stream URL only when ExoPlayer starts loading them. Stream URLs (YouTube in particular)
 * expire, so resolving at load time keeps long queues and resumed sessions playable.
 *
 * Resolvers run on ExoPlayer's loader thread, so blocking network calls are fine.
 */
data class ResolvedStream(val uri: Uri, val headers: Map<String, String> = emptyMap())

fun interface StreamResolver {
  @Throws(IOException::class)
  fun resolve(id: String): ResolvedStream
}

object StreamResolvers {
  const val SCHEME = "emusic"

  private val resolvers = ConcurrentHashMap<String, StreamResolver>()

  fun register(source: String, resolver: StreamResolver) {
    resolvers[source] = resolver
  }

  @Throws(IOException::class)
  fun resolve(uri: Uri): ResolvedStream {
    val source = uri.host ?: throw IOException("Missing source in $uri")
    val id = uri.lastPathSegment ?: throw IOException("Missing id in $uri")
    val resolver = resolvers[source] ?: throw IOException("No resolver registered for '$source'")
    return resolver.resolve(id)
  }
}
