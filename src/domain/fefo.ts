import type { Batch } from './types';
import { expiryDate } from './expiry';

export const isLive = (b: Batch): boolean => b.status === 'active' && b.qty > 0;

// Soonest expiry first, tie by older createdAt.
export const byExpiry = (a: Batch, b: Batch): number =>
  expiryDate(a.expiry).getTime() - expiryDate(b.expiry).getTime() || a.createdAt - b.createdAt;

export const pickBatchForSale = (batches: Batch[]): Batch | null =>
  batches.filter(isLive).sort(byExpiry)[0] ?? null;
