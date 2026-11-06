export type ShopCollection =
  'devices' | 'categories' | 'companies' | 'medicines' | 'batches' | 'bills' | 'events' | 'checks';

export const shopPath = (shopId: string) => `shops/${shopId}`;
export const colPath = (shopId: string, c: ShopCollection) => `${shopPath(shopId)}/${c}`;
export const docPath = (shopId: string, c: ShopCollection, id: string) =>
  `${colPath(shopId, c)}/${id}`;
