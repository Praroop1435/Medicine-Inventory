export type PdfPageImage = { uri: string; width: number; height: number };

export interface PdfRenderer {
  /** Renders up to `maxPages` pages; `pageCount` is the real total. */
  renderPages(
    uri: string,
    maxPages: number,
  ): Promise<{ pageCount: number; images: PdfPageImage[] }>;
  /** Deletes rendered page images (they are bill photos). */
  cleanup?(uris: string[]): void;
}
