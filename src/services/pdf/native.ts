import PdfThumbnail, { PdfThumbnailErrorCodes } from 'react-native-pdf-thumbnail';
import type { PdfRenderer } from './PdfRenderer';

/**
 * react-native-pdf-thumbnail 2.0: maintained (2026), New Architecture TurboModule, Android renders
 * with the platform PdfRenderer. It has no page-count call, so we render pages one at a time and
 * treat INVALID_PAGE as the end; rendering one page past the cap tells us the PDF is longer.
 */
export const nativePdfRenderer: PdfRenderer = {
  async renderPages(uri, maxPages) {
    const images = [];
    for (let page = 0; page <= maxPages; page++) {
      try {
        const { uri: out, width, height } = await PdfThumbnail.generate(uri, page);
        if (page === maxPages) return { pageCount: maxPages + 1, images };
        images.push({ uri: out, width, height });
      } catch (e) {
        if (page > 0 && (e as { code?: string }).code === PdfThumbnailErrorCodes.INVALID_PAGE)
          break;
        throw e;
      }
    }
    return { pageCount: images.length, images };
  },
};
