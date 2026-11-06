package expo.modules.pdfpages

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

/** Renders PDF pages to JPEGs in the cache dir at a chosen pixel width, using the platform PdfRenderer. */
class PdfPagesModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun <T> withRenderer(uri: String, block: (PdfRenderer) -> T): T {
    val fd: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(Uri.parse(uri), "r")
      ?: throw IllegalArgumentException("Cannot open $uri")
    try {
      val renderer = PdfRenderer(fd)
      try {
        return block(renderer)
      } finally {
        renderer.close()
      }
    } finally {
      fd.close()
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PdfPages")

    AsyncFunction("getPageCount") { uri: String -> withRenderer(uri) { it.pageCount } }

    AsyncFunction("renderPage") { uri: String, pageIndex: Int, targetWidth: Int ->
      withRenderer(uri) { renderer ->
        val page = renderer.openPage(pageIndex)
        try {
          val scale = targetWidth.toFloat() / page.width
          val height = Math.round(page.height * scale)
          val bitmap = Bitmap.createBitmap(targetWidth, height, Bitmap.Config.ARGB_8888)
          try {
            bitmap.eraseColor(Color.WHITE)
            page.render(bitmap, null, Matrix().apply { setScale(scale, scale) }, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            val out = File.createTempFile("pdfpage-", ".jpg", context.cacheDir)
            FileOutputStream(out).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) }
            mapOf("uri" to Uri.fromFile(out).toString(), "width" to targetWidth, "height" to height)
          } finally {
            bitmap.recycle()
          }
        } finally {
          page.close()
        }
      }
    }
  }
}
