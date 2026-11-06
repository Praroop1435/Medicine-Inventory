import { findMedicineMatch, normalizeName } from '../matching';
import type { Medicine } from '../types';

const med = (id: string, name: string): Medicine => ({
  id,
  name,
  categoryId: 'c1',
  companyId: 'co1',
  unit: 'strip',
});

describe('normalizeName', () => {
  it('lowercases, strips punctuation, splits digits from letters', () => {
    expect(normalizeName('AZITHRAL-500')).toBe('azithral 500');
    expect(normalizeName('Syrup 100ml')).toBe('syrup 100 ml');
    expect(normalizeName('  Dolo   650mg. ')).toBe('dolo 650 mg');
  });
});

describe('findMedicineMatch', () => {
  const az = med('m1', 'Azithral 500');
  it('matches despite punctuation/case', () => {
    expect(findMedicineMatch('AZITHRAL-500', [az])).toBe(az);
  });
  it('rejects different numbers', () => {
    expect(findMedicineMatch('Azithral 250', [az])).toBeNull();
  });
  it('fuzzy matches typos when numbers match', () => {
    const b = med('m2', 'Benadryl syrup 100 ml');
    expect(findMedicineMatch('Benadril syrup 100ml', [b])).toBe(b);
  });
  it('prefers exact over fuzzy, and returns null for unrelated', () => {
    const a = med('a', 'Dolo 650');
    const b = med('b', 'Dolo 650 mg');
    expect(findMedicineMatch('dolo 650', [b, a])).toBe(a);
    expect(findMedicineMatch('Crocin', [a])).toBeNull();
  });
  it('never matches names with a different number of words (CLAVAM DRY vs CLAVAM BID DRY)', () => {
    const bid = med('bid', 'CLAVAM BID DRY SYP');
    expect(findMedicineMatch('CLAVAM DRY SYP', [bid])).toBeNull();
    expect(findMedicineMatch('CLAVAM BID DRY SYP', [bid])).toBe(bid);
  });
});
