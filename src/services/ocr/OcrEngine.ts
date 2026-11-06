/** One recognised word or line with its position in the photo (pixels). `height` is optional. */
export type OcrLine = { text: string; top: number; left: number; height?: number };

export interface OcrEngine {
  recognize(imageUri: string): Promise<OcrLine[]>;
}
