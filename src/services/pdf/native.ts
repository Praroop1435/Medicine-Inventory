import { File } from 'expo-file-system';
import { pdfPages } from '../../../modules/pdf-pages';
import type { PdfRenderer } from './PdfRenderer';

// ML Kit reads text best at ~16-24px glyphs; 2000px across an A4 page gives about 25px.
const PAGE_WIDTH = 2000;

/** Local Expo module (modules/pdf-pages) over Android's PdfRenderer. */
export const nativePdfRenderer: PdfRenderer = {
  async renderPages(uri, maxPages) {
    const pageCount = await pdfPages.getPageCount(uri);
    const images = [];
    for (let i = 0; i < Math.min(pageCount, maxPages); i++)
      images.push(await pdfPages.renderPage(uri, i, PAGE_WIDTH));
    return { pageCount, images };
  },
  cleanup(uris) {
    for (const u of uris)
      try {
        new File(u).delete();
      } catch {
        // already gone
      }
  },
};
