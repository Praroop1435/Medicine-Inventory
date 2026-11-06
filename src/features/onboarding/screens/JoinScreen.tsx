import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorState, Screen, T, tokens } from '@/ui';
import { parseQrPayload } from '../qr';

function QrScanner({ onScan }: { onScan: (data: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  if (!permission) return null;
  if (!permission.granted)
    return (
      <View style={{ gap: tokens.space[3] }}>
        <T size={14} color={tokens.color.muted}>
          The camera is needed to scan the shop QR from another phone.
        </T>
        <Button label="Allow camera" onPress={requestPermission} />
      </View>
    );
  return (
    <View style={{ borderRadius: tokens.radius.card, overflow: 'hidden' }}>
      <CameraView
        style={{ width: '100%', aspectRatio: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => onScan(data)}
      />
    </View>
  );
}

const NOT_A_SHOP_QR = "This isn't a shop QR code";
const goToName = (qr: string) => router.push({ pathname: '/onboarding/name', params: { qr } });

/** `scanned` lets tests hand in a payload instead of using the camera. */
export function JoinScreen({ scanned }: { scanned?: string }) {
  const [scanError, setScanError] = useState<string | null>(null);
  const done = useRef(false);
  const error = scanned && !parseQrPayload(scanned) ? NOT_A_SHOP_QR : scanError;

  const onScan = useCallback((data: string) => {
    if (done.current) return;
    if (!parseQrPayload(data)) return setScanError(NOT_A_SHOP_QR);
    done.current = true;
    goToName(data);
  }, []);

  useEffect(() => {
    if (scanned && parseQrPayload(scanned)) goToName(scanned);
  }, [scanned]);

  return (
    <Screen back="Back" title="Join shop" meta="Scan the shop QR shown on another phone">
      <View style={{ gap: tokens.space[4] }}>
        {scanned ? null : <QrScanner onScan={onScan} />}
        {error ? <ErrorState message={error} /> : null}
      </View>
    </Screen>
  );
}
