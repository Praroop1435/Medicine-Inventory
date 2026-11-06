import type { Company, Medicine } from '@/domain/types';
import { parseVoiceEntry } from '../voiceParser';

const companies: Company[] = [
  { id: 'c1', name: 'Alembic' },
  { id: 'c2', name: 'Sun Pharma' },
];
const medicines: Medicine[] = [
  { id: 'm1', name: 'Dolo 650', categoryId: 'cat1', companyId: 'c2', unit: 'strip' },
];

describe('parseVoiceEntry', () => {
  it('parses a full spoken entry', () => {
    const d = parseVoiceEntry(
      'Azithral 500, Alembic, batch A Z 8 8, expiry November 2026, 2 cartons',
      [],
      companies,
    );
    expect(d).toMatchObject({
      source: 'voice',
      medicineName: 'Azithral 500',
      companyName: 'Alembic',
      batchNo: 'AZ88',
      expiry: { year: 2026, month: 11 },
      qty: 2,
      unit: 'carton',
    });
    expect(d.uncertain).toEqual(expect.arrayContaining(['batchNo', 'expiry']));
    expect(d.uncertain).not.toContain('qty');
  });

  it('parses spoken numbers, letters and a month-number expiry', () => {
    const d = parseVoiceEntry(
      'benadryl syrup batch k two two three one expiry eleven twenty six six bottles',
      [],
      companies,
    );
    expect(d).toMatchObject({
      medicineName: 'benadryl syrup',
      batchNo: 'K2231',
      expiry: { year: 2026, month: 11 },
      qty: 6,
      unit: 'bottle',
    });
  });

  it('handles short month names and digit expiry', () => {
    expect(parseVoiceEntry('x batch b1 expiry nov 26 3 strips', [], []).expiry).toEqual({
      year: 2026,
      month: 11,
    });
    expect(parseVoiceEntry('x batch b1 exp 11 26 3 strips', [], []).expiry).toEqual({
      year: 2026,
      month: 11,
    });
  });

  it('flags a missing qty and unreadable expiry', () => {
    const d = parseVoiceEntry('Crocin batch c1 expiry sometime', [], []);
    expect(d.qty).toBeNull();
    expect(d.expiry).toBeNull();
    expect(d.uncertain).toEqual(expect.arrayContaining(['batchNo', 'expiry', 'qty']));
  });

  it('flags a missing name', () => {
    expect(parseVoiceEntry('batch a1', [], []).uncertain).toContain('medicineName');
  });

  it('takes the company from an existing medicine match', () => {
    const d = parseVoiceEntry('dolo 650 batch d1 expiry 11 26 5 strips', medicines, companies);
    expect(d).toMatchObject({
      matchedMedicineId: 'm1',
      companyName: 'Sun Pharma',
      categoryId: 'cat1',
      unit: 'strip',
    });
  });

  it('strips a trailing company from the name', () => {
    const d = parseVoiceEntry('Azithral 500 Alembic batch a1', [], companies);
    expect(d.medicineName).toBe('Azithral 500');
    expect(d.companyName).toBe('Alembic');
  });

  it('reads expiry before batch', () => {
    const d = parseVoiceEntry('Crocin expiry nov 26 batch c 1 2 5 strips', [], []);
    expect(d).toMatchObject({
      medicineName: 'Crocin',
      batchNo: 'C12',
      expiry: { year: 2026, month: 11 },
      qty: 5,
      unit: 'strip',
    });
  });
});
