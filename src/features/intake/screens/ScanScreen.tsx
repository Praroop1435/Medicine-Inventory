import { getDocumentAsync } from 'expo-document-picker';
import { CameraView } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { cameraPermission } from '@/services/camera';
import type { OcrEngine } from '@/services/ocr/OcrEngine';
import { parseBillText } from '@/services/ocr/billParser';
import { mlkitOcrEngine } from '@/services/ocr/mlkit';
import { nativePdfRenderer } from '@/services/pdf/native';
import type { PdfRenderer } from '@/services/pdf/PdfRenderer';
import type { Permission } from '@/services/Permission';
import { MAX_PDF_PAGES, readPdfBill } from '@/services/pdf/readPdfBill';
import { Button, ButtonRow, RoundButton, Screen, ShutterButton, T, tokens } from '@/ui';
import { PermissionPrompt, usePermissionGate } from '@/features/shared/PermissionGate';
import { useToast } from '@/features/shared/Toast';
import { useIntake } from '../IntakeContext';

const NOTHING_READ = "Couldn't read any medicines. Try again with better light, or type them.";

const FAILED = "Couldn't read the photo. Try again.";
const PDF_FAILED = "Couldn't open this PDF.";

/** Photograph or pick a bill, read it on-device, then review. The photo is never uploaded. */
export function ScanScreen({
  engine = mlkitOcrEngine,
  renderer = nativePdfRenderer,
  camera: cameraSource = cameraPermission,
}: {
  engine?: OcrEngine;
  renderer?: PdfRenderer;
  camera?: Permission;
}) {
  const { setDrafts } = useIntake();
  const toast = useToast();
  const gate = usePermissionGate('camera', cameraSource);
  const camera = useRef<CameraView>(null);
  const busy = useRef(false);
  const [phase, setPhase] = useState<'ready' | 'reading' | 'empty' | 'failed'>('ready');
  const [progress, setProgress] = useState('Reading bill…');
  const [isPdf, setIsPdf] = useState(false);
  // The captured or picked photo, frozen under the reading progress.
  const [photo, setPhoto] = useState<string | null>(null);

  const read = async (uri: string | undefined, pdf = false) => {
    if (!uri) return setPhase('ready');
    setIsPdf(pdf);
    setPhoto(pdf ? null : uri);
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
    if (truncated) toast(`Only the first ${MAX_PDF_PAGES} pages were read.`);
    // Stay on the frozen photo while leaving: remounting the camera under the pushed screen
    // freezes the Android display on the old frame. The camera comes back on refocus.
    router.push('/intake/review');
  };
  // Each focus mounts a fresh camera: reusing the old preview after Back left its lower part black.
  const [focusCount, setFocusCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setPhase((p) => (p === 'reading' ? 'ready' : p));
      setFocusCount((n) => n + 1);
    }, []),
  );
  // One capture/pick at a time: a second tap while the camera, picker or OCR is busy is ignored.
  const run = async (getUri: () => Promise<string | undefined>, pdf = false) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await read(await getUri(), pdf);
    } catch {
      // the camera or a picker rejected: say so rather than silently staying put
      setIsPdf(pdf);
      setPhase('failed');
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

  // The live camera (or, before permission, the reason) in a 3:4 frame with the bill guide.
  const granted = gate.state === 'granted';
  const frame = (content: ReactNode, overlay?: ReactNode) => (
    <View
      style={{
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: tokens.radius.card,
        overflow: 'hidden',
        justifyContent: 'center',
        backgroundColor: tokens.color.navy,
      }}
    >
      {content}
      {overlay}
    </View>
  );
  const guide = (
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
  );

  if (phase === 'reading')
    return (
      <Screen back="Back" title="Scan bill">
        {frame(
          photo ? (
            <Image
              source={{ uri: photo }}
              resizeMode="cover"
              style={{ position: 'absolute', width: '100%', height: '100%' }}
            />
          ) : null,
          <View
            style={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tokens.color.scrim,
            }}
          >
            <T size={16} weight="semibold" color={tokens.color.onPrimary}>
              {progress}
            </T>
          </View>,
        )}
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

  return (
    <Screen
      back="Back"
      title="Scan bill"
      footer={
        <View style={{ gap: tokens.space[2] }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}
          >
            <RoundButton icon="image" caption="Gallery" label="Photo from gallery" onPress={pick} />
            <ShutterButton
              label={granted ? 'Take photo' : 'Allow camera'}
              onPress={granted ? capture : gate.allow}
            />
            <RoundButton icon="file" caption="PDF" label="PDF file" onPress={pickPdf} />
          </View>
          <Button
            label="Type instead"
            variant="text"
            onPress={() => router.replace('/intake/manual')}
          />
        </View>
      }
    >
      {granted ? (
        frame(
          <CameraView
            key={`camera-${focusCount}`}
            testID={`camera-${focusCount}`}
            ref={camera}
            style={{ position: 'absolute', inset: 0 }}
          />,
          guide,
        )
      ) : (
        <PermissionPrompt
          gate={gate}
          icon="camera"
          reason="The camera is used to photograph bills. Photos stay on this phone."
          off="Camera permission is off. Allow it to photograph the bill, or pick a photo instead."
        />
      )}
    </Screen>
  );
}
