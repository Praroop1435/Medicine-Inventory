import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { OcrEngine, OcrLine } from './OcrEngine';

/** Words, not lines: ML Kit lines can span several table columns. */
export const mlkitOcrEngine: OcrEngine = {
  async recognize(imageUri) {
    const result = await TextRecognition.recognize(imageUri);
    const out: OcrLine[] = [];
    for (const block of result.blocks)
      for (const line of block.lines)
        for (const w of line.elements.length ? line.elements : [line]) {
          if (w.frame)
            out.push({
              text: w.text,
              top: w.frame.top,
              left: w.frame.left,
              height: w.frame.height,
              width: w.frame.width,
              corners: w.cornerPoints,
            });
        }
    return out;
  },
};
