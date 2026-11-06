import { router } from 'expo-router';
import { getDocumentAsync } from 'expo-document-picker';
import { useState } from 'react';
import { View } from 'react-native';
import type { DraftBatch } from '@/domain/draft';
import { shopUnits } from '@/domain/types';
import { useShop } from '@/features/shared/hooks/useShop';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToast } from '@/features/shared/Toast';
import { parseSheetRows, type SheetError } from '@/services/bulk/sheetParser';
import { readSheetFile, shareTemplate } from '@/services/bulk/template';
import { Button, ButtonRow, Card, IconTile, ListRow, Screen, T, tokens } from '@/ui';
import { useIntake } from '../IntakeContext';

/** Import stock from a CSV/XLSX sheet; a clean file goes straight to review. */
export function BulkScreen() {
  const { categories } = useInventory();
  const shop = useShop();
  const { setDrafts } = useIntake();
  const toast = useToast();
  const [result, setResult] = useState<{ drafts: DraftBatch[]; errors: SheetError[] } | null>(null);

  const review = (drafts: DraftBatch[]) => {
    setDrafts(drafts);
    router.push('/intake/review');
  };

  const pick = async () => {
    try {
      const res = await getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled) return;
      const rows = await readSheetFile(res.assets[0].uri).catch(() => null);
      if (!rows) return toast("Couldn't read this file. Save it as .xlsx or .csv and try again.");
      const parsed = parseSheetRows(rows, categories, shopUnits(shop));
      if (parsed.errors.length) setResult(parsed);
      else if (parsed.drafts.length) review(parsed.drafts);
      else toast('No rows found in that file');
    } catch (e) {
      toast(
        e instanceof Error
          ? e.message
          : "Couldn't read that file. Save it as .xlsx or .csv and try again.",
      );
    }
  };

  return (
    <Screen back="Back" title="Bulk import">
      <View style={{ gap: tokens.space[3] }}>
        <Card>
          <View style={{ padding: tokens.space[4], gap: tokens.space[3], alignItems: 'center' }}>
            <IconTile icon="sheet" size={tokens.emptyIcon} round />
            <T color={tokens.color.muted} style={{ textAlign: 'center' }}>
              Fill the template on a computer or in Sheets, then pick the file (.xlsx or .csv).
            </T>
          </View>
        </Card>
        <ButtonRow>
          <Button
            label="Get template"
            variant="secondary"
            onPress={() =>
              shareTemplate().catch(() => toast("Couldn't share the template. Try again."))
            }
          />
          <Button label="Pick file" onPress={pick} />
        </ButtonRow>
        {result ? (
          <>
            <Card>
              {result.errors.map((e, i) => (
                <ListRow key={i} title={`Row ${e.row}: ${e.message}`} />
              ))}
            </Card>
            {result.drafts.length ? (
              <Button
                label={`Review ${result.drafts.length} good row${result.drafts.length === 1 ? '' : 's'}`}
                onPress={() => review(result.drafts)}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
