import { getDocumentAsync } from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { OcrEngine } from '@/services/ocr/OcrEngine';
import { parseBillText } from '@/services/ocr/billParser';
import { mlkitOcrEngine } from '@/services/ocr/mlkit';
import { nativePdfRenderer } from '@/services/pdf/native';
import type { PdfRenderer } from '@/services/pdf/PdfRenderer';
import { MAX_PDF_PAGES, readPdfBill } from '@/services/pdf/readPdfBill';
import { Button, ButtonRow, Screen, T, tokens } from '@/ui';
import { useToast } from '@/features/shared/Toast';
import { useIntake } from '../IntakeContext';

const NOTHING_READ = "Couldn't read any medicines. Try again with better light, or type them.";

const FAILED = "Couldn't read the photo. Try again.";
const PDF_FAILED = "Couldn't open this PDF.";

/** Photograph or pick a bill, read it on-device, then review. The photo is never uploaded. */
export function ScanScreen({
  engine = mlkitOcrEngine,
  renderer = nativePdfRenderer,
}: {
  engine?: OcrEngine;
  renderer?: PdfRenderer;
}) {
  const { setDrafts } = useIntake();
  const toast = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const busy = useRef(false);
  const [phase, setPhase] = useState<'ready' | 'reading' | 'empty' | 'failed'>('ready');
  const [progress, setProgress] = useState('Reading bill…');
  const [isPdf, setIsPdf] = useState(false);

  const read = async (uri: string | undefined, pdf = false) => {
    if (!uri) return setPhase('ready');
    setIsPdf(pdf);
    setProgress(pdf ? 'Preparing pages…' : 'Reading bill…');
    setPhase('reading');
    let parsed: ReturnType<typeof parseBillText>;
    let truncated = false;
    try {
      if (pdf) {
        const r = await readPdfBill(uri, renderer, engine, (p, n) =>
          setProgress(`Reading page ${p} of ${n}…`),
        );
        truncated = r.truncated;
        parsed = parseBillText(r.lines);
      } else parsed = parseBillText(await engine.recognize(uri));
    } catch {
      return setPhase('failed');
    }
    if (!parsed.drafts.length) return setPhase('empty');
    setDrafts(parsed.drafts, { supplier: '', billNo: '', billDate: '', ...parsed.header });
    setPhase('ready');
    if (truncated) toast(`Only the first ${MAX_PDF_PAGES} pages were read.`);
    router.push('/intake/review');
  };
  // One capture/pick at a time: a second tap while the camera, picker or OCR is busy is ignored.
  const run = async (getUri: () => Promise<string | undefined>, pdf = false) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await read(await getUri(), pdf);
    } finally {
      busy.current = false;
    }
  };
  const capture = () =>
    run(async () => (await camera.current?.takePictureAsync({ quality: 0.8 }))?.uri);
  const pick = () =>
    run(async () => {
      const r = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      return r.canceled ? undefined : r.assets[0]?.uri;
    });
  const pickPdf = () =>
    run(async () => {
      const r = await getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      return r.canceled ? undefined : r.assets[0]?.uri;
    }, true);

  if (phase === 'reading')
    return (
      <Screen back="Back" title="Scan bill">
        <T color={tokens.color.muted}>{progress}</T>
      </Screen>
    );
  if (phase === 'empty' || phase === 'failed')
    return (
      <Screen back="Back" title="Scan bill">
        <View style={{ gap: tokens.space[3] }}>
          <T color={tokens.color.muted}>
            {phase === 'failed' ? (isPdf ? PDF_FAILED : FAILED) : NOTHING_READ}
          </T>
          <ButtonRow>
            <Button label="Retake" variant="secondary" onPress={() => setPhase('ready')} />
            <Button label="Type instead" onPress={() => router.replace('/intake/manual')} />
          </ButtonRow>
        </View>
      </Screen>
    );

  const granted = permission?.granted;
  return (
    <Screen back="Back" title="Scan bill">
      <View style={{ gap: tokens.space[3] }}>
        {granted ? (
          <View style={{ borderRadius: tokens.radius.card, overflow: 'hidden' }}>
            <CameraView ref={camera} style={{ width: '100%', aspectRatio: 3 / 4 }} />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                inset: tokens.space[4],
                borderWidth: tokens.stroke,
                borderColor: tokens.color.surface,
                borderRadius: tokens.radius.control,
              }}
            />
          </View>
        ) : permission ? (
          <T color={tokens.color.muted}>
            Camera permission is off. Allow it to photograph the bill, or pick a photo instead.
          </T>
        ) : null}
        <ButtonRow>
          {granted || !permission ? (
            <Button label="Camera" disabled={!granted} onPress={capture} />
          ) : (
            <Button label="Allow camera" onPress={requestPermission} />
          )}
          <Button label="Photo from gallery" variant="secondary" onPress={pick} />
          <Button label="PDF file" variant="secondary" onPress={pickPdf} />
        </ButtonRow>
      </View>
    </Screen>
  );
}
