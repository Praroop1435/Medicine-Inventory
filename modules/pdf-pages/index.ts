import { requireNativeModule } from 'expo';

type PdfPages = {
  getPageCount(uri: string): Promise<number>;
  renderPage(
    uri: string,
    pageIndex: number,
    targetWidth: number,
  ): Promise<{ uri: string; width: number; height: number }>;
};

// Resolved on first use so importing this file never needs the native module (e.g. under Jest).
let native: PdfPages | undefined;
export const pdfPages: PdfPages = {
  getPageCount: (uri) => (native ??= requireNativeModule<PdfPages>('PdfPages')).getPageCount(uri),
  renderPage: (uri, i, w) =>
    (native ??= requireNativeModule<PdfPages>('PdfPages')).renderPage(uri, i, w),
};
