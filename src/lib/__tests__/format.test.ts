import { expiresIn, pluralUnit } from '../format';

describe('pluralUnit', () => {
  it.each([
    ['carton', 1, '1 carton'],
    ['carton', 5, '5 cartons'],
    ['box', 2, '2 boxes'],
    ['piece', 0, '0 pieces'],
    ['strip', 3, '3 strips'],
    ['bottle', 6, '6 bottles'],
    ['capsule', 2, '2 capsules'],
    ['ampoule', 4, '4 ampoules'],
    ['inhaler', 2, '2 inhalers'],
    ['drops', 2, '2 drops'],
    ['drops', 1, '1 drops'],
    ['kit', 3, '3 kits'],
    ['kit', 1, '1 kit'],
    ['patch', 2, '2 patches'],
    ['glass', 2, '2 glasses'],
  ] as const)('%s x %i', (unit, n, out) => expect(pluralUnit(unit, n)).toBe(out));
});

describe('expiresIn', () => {
  it.each([
    [0, 'today'],
    [1, 'in 1 day'],
    [59, 'in 59 days'],
    [60, 'in 2 months'],
    [-3, '3 days ago'],
    [-1, '1 day ago'],
  ])('%i days', (d, out) => expect(expiresIn(d)).toBe(out));
});
