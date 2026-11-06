export type PdfPageImage = { uri: string; width: number; height: number };

export interface PdfRenderer {
  /** Renders up to `maxPages` pages; `pageCount` may be a lower bound once it exceeds `maxPages`. */
  renderPages(
    uri: string,
    maxPages: number,
  ): Promise<{ pageCount: number; images: PdfPageImage[] }>;
}
