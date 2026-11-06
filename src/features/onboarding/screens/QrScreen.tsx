import * as Sharing from 'expo-sharing';
import { useRef, type ComponentRef } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import { useShop } from '@/features/shared/hooks/useShop';
import { errorCopy, useToast } from '@/features/shared/Toast';
import { Button, ButtonRow, Card, Screen, T, tokens } from '@/ui';
import { resetTo } from '../resetTo';
import { toQrPayload } from '../qr';

/** `again` = shown from Settings: Back instead of the onboarding "I saved it". */
export function QrScreen({ again }: { again?: boolean }) {
  const shop = useShop();
  const toast = useToast();
  const qrRef = useRef<ComponentRef<typeof View>>(null);

  const save = async () => {
    try {
      const uri = await captureRef(qrRef, { format: 'png' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save shop QR' });
    } catch (e) {
      toast(errorCopy(e, "Couldn't save the QR. Try again."));
    }
  };

  return (
    <Screen
      back={again ? 'Settings' : undefined}
      title={again ? 'Shop QR' : 'Save your shop QR'}
      footer={
        again ? (
          <Button label="Save QR image" full disabled={!shop} onPress={save} />
        ) : (
          <ButtonRow>
            <Button label="Save QR image" variant="secondary" disabled={!shop} onPress={save} />
            <Button label="I saved it" onPress={() => resetTo('/onboarding/notify')} />
          </ButtonRow>
        )
      }
    >
      <T size={16}>
        This QR is the only way back into your shop if every phone is lost. Save or print it.
      </T>
      <View style={{ paddingTop: tokens.space[4] }}>
        <Card>
          {/* collapsable=false keeps the view in the native tree so it can be captured. */}
          <View
            ref={qrRef}
            collapsable={false}
            style={{
              alignItems: 'center',
              gap: tokens.space[3],
              padding: tokens.space[6],
              backgroundColor: tokens.color.surface,
            }}
          >
            {shop ? (
              <>
                <QRCode
                  value={toQrPayload(shop.id, shop.joinSecret)}
                  size={tokens.qr}
                  color={tokens.color.text}
                  backgroundColor={tokens.color.surface}
                />
                <T size={16} weight="medium">
                  {shop.name}
                </T>
              </>
            ) : null}
          </View>
        </Card>
      </View>
    </Screen>
  );
}
