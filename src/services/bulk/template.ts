import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { read, utils } from 'xlsx';
import { TEMPLATE_HEADERS } from './sheetParser';

/** First sheet of a CSV/XLSX file as rows of text; row 0 is the header. */
export async function readSheetFile(uri: string): Promise<string[][]> {
  const wb = read(await new File(uri).base64(), { type: 'base64' });
  return utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    raw: false,
    defval: '',
  });
}

export async function shareTemplate(): Promise<void> {
  const file = new File(Paths.cache, 'medicine-import-template.csv');
  file.create({ overwrite: true });
  file.write(
    `${TEMPLATE_HEADERS.join(',')}\nAntibiotics,Alembic,Azithral 500,carton,AZ88,11/26,2\n`,
  );
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Import template' });
}
