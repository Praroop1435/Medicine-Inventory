import { pluralUnit } from '../format';

describe('pluralUnit', () => {
  it.each([
    ['carton', 1, '1 carton'],
    ['carton', 5, '5 cartons'],
    ['box', 2, '2 boxes'],
    ['piece', 0, '0 pieces'],
    ['strip', 3, '3 strips'],
    ['bottle', 6, '6 bottles'],
  ] as const)('%s x %i', (unit, n, out) => expect(pluralUnit(unit, n)).toBe(out));
});
