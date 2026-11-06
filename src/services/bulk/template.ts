import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { read, utils } from 'xlsx';
import { DATE_CELL, TEMPLATE_HEADERS } from './sheetParser';

/** First sheet of a CSV/XLSX file as rows of text; row 0 is the header. */
export async function readSheetFile(uri: string): Promise<string[][]> {
  const wb = read(await new File(uri).base64(), { type: 'base64', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // A date cell would render as an ambiguous display string; flag it instead.
  for (const [k, c] of Object.entries(ws)) {
    if (k[0] !== '!' && c.t === 'd') ws[k] = { t: 's', v: DATE_CELL };
  }
  return utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
  });
}

export async function shareTemplate(): Promise<void> {
  const file = new File(Paths.cache, 'medicine-import-template.csv');
  file.create({ overwrite: true });
  await file.write(
    `${TEMPLATE_HEADERS.join(',')}\nAntibiotics,Alembic,Azithral 500,carton,AZ88,11/26,2\n`,
  );
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Import template' });
}
