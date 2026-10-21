package app.emusic.player.youtube

import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import java.net.HttpURLConnection
import java.net.URL

/** NewPipeExtractor's network layer, on plain HttpURLConnection to avoid another HTTP client. */
internal object HttpDownloader : Downloader() {
  private const val USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0"

  override fun execute(request: Request): Response {
    val conn = URL(request.url()).openConnection() as HttpURLConnection
    try {
      conn.requestMethod = request.httpMethod()
      conn.connectTimeout = 15_000
      conn.readTimeout = 20_000
      conn.setRequestProperty("User-Agent", USER_AGENT)
      for ((name, values) in request.headers()) {
        values.forEach { conn.addRequestProperty(name, it) }
      }
      request.dataToSend()?.let { body ->
        conn.doOutput = true
        conn.outputStream.use { it.write(body) }
      }

      val code = conn.responseCode
      if (code == 429) throw ReCaptchaException("YouTube rate limit", request.url())
      val stream = if (code >= 400) conn.errorStream else conn.inputStream
      val body = stream?.use { it.readBytes().toString(Charsets.UTF_8) } ?: ""
      val headers = conn.headerFields.entries
        .filter { it.key != null }
        .associate { it.key!! to it.value }
      return Response(code, conn.responseMessage, headers, body, conn.url.toString())
    } finally {
      conn.disconnect()
    }
  }
}
