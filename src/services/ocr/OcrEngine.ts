/**
 * One recognised word or line with its position in the photo (pixels). `corners` are the text's
 * own corner points (top-left first, clockwise in reading order), so they reveal a sideways photo.
 */
export type OcrLine = {
  text: string;
  top: number;
  left: number;
  height?: number;
  width?: number;
  corners?: readonly { x: number; y: number }[];
};

export interface OcrEngine {
  recognize(imageUri: string): Promise<OcrLine[]>;
}
