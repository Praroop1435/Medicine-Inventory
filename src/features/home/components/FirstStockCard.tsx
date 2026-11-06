import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, ButtonRow, Card, Logo, T, tokens } from '@/ui';

/** Home on a shop with no medicines yet: the three everyday ways in, plus bulk import. */
export function FirstStockCard() {
  return (
    <Card>
      <View style={{ padding: tokens.space[4], gap: tokens.space[3] }}>
        <Logo size={tokens.logo.glyph} />
        <View style={{ gap: tokens.space[1] }}>
          <T size={20} weight="semibold" accessibilityRole="header">
            Add your first stock
          </T>
          <T size={14} color={tokens.color.muted}>
            Scan a distributor bill, speak, or type what&apos;s on the shelf.
          </T>
        </View>
        <ButtonRow>
          <Button label="Scan bill" onPress={() => router.push('/intake/scan')} />
          <Button label="Speak" variant="secondary" onPress={() => router.push('/intake/voice')} />
          <Button label="Type" variant="secondary" onPress={() => router.push('/intake/manual')} />
        </ButtonRow>
        <Button
          label="Bulk import from a spreadsheet"
          variant="text"
          onPress={() => router.push('/intake/bulk')}
        />
      </View>
    </Card>
  );
}
