export type JoinPayload = { v: 1; shopId: string; joinSecret: string };

export const toQrPayload = (shopId: string, joinSecret: string): string =>
  JSON.stringify({ v: 1, shopId, joinSecret });

// Ids end up in Firestore paths, so only plain id characters are accepted.
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Returns null for anything that is not a v1 shop QR. */
export function parseQrPayload(raw: string): JoinPayload | null {
  try {
    const p: unknown = JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return null;
    const { v, shopId, joinSecret } = p as Record<string, unknown>;
    if (v !== 1 || typeof shopId !== 'string' || typeof joinSecret !== 'string') return null;
    if (!ID.test(shopId) || !ID.test(joinSecret)) return null;
    return { v: 1, shopId, joinSecret };
  } catch {
    return null;
  }
}
