import { CameraView, useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import type { OcrEngine } from '@/services/ocr/OcrEngine';
import { parseBillText } from '@/services/ocr/billParser';
import { mlkitOcrEngine } from '@/services/ocr/mlkit';
import { Button, ButtonRow, Screen, T, tokens } from '@/ui';
import { useIntake } from '../IntakeContext';

const NOTHING_READ = "Couldn't read any medicines. Try again with better light, or type them.";

/** Photograph or pick a bill, read it on-device, then review. The photo is never uploaded. */
export function ScanScreen({ engine = mlkitOcrEngine }: { engine?: OcrEngine }) {
  const { setDrafts } = useIntake();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [phase, setPhase] = useState<'ready' | 'reading' | 'empty'>('ready');

  const read = async (uri: string | undefined) => {
    if (!uri) return setPhase('ready');
    setPhase('reading');
    try {
      const { header, drafts } = parseBillText(await engine.recognize(uri));
      if (!drafts.length) return setPhase('empty');
      setDrafts(drafts, { supplier: '', billNo: '', billDate: '', ...header });
      setPhase('ready');
      router.push('/intake/review');
    } catch {
      setPhase('empty');
    }
  };
  const capture = async () => read((await camera.current?.takePictureAsync({ quality: 0.8 }))?.uri);
  const pick = async () => {
    const r = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    await read(r.canceled ? undefined : r.assets[0]?.uri);
  };

  if (phase === 'reading')
    return (
      <Screen back="Back" title="Scan bill">
        <T color={tokens.color.muted}>Reading bill…</T>
      </Screen>
    );
  if (phase === 'empty')
    return (
      <Screen back="Back" title="Scan bill">
        <View style={{ gap: tokens.space[3] }}>
          <T color={tokens.color.muted}>{NOTHING_READ}</T>
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
                borderWidth: 2,
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
            <Button label="Capture" disabled={!granted} onPress={capture} />
          ) : (
            <Button label="Allow camera" onPress={requestPermission} />
          )}
          <Button label="Pick from gallery" variant="secondary" onPress={pick} />
        </ButtonRow>
      </View>
    </Screen>
  );
}
