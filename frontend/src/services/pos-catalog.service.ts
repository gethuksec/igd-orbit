import { api } from './api';
import { posCatalogCache } from '@/lib/offline-db';

// IGDERP-244: bulk catalog for offline PoS. Stored on page render (online),
// searched locally when offline. Same shapes as /pos/products + /pos/customers.

export interface PosCatalog {
  products: any[];
  customers: any[];
  warehouseId: string | null;
  cachedAt: string;
}

// Same 7-day default as smart-service masters (posCatalogCache pattern).
export const CATALOG_TTL_MS = 7 * 24 * 3600 * 1000;

export const catalogKey = (warehouseId?: string) =>
  `pos-catalog:${warehouseId || 'all'}`;

export async function fetchCatalog(warehouseId?: string): Promise<PosCatalog> {
  const res = await api.get('/pos/catalog', {
    params: warehouseId ? { warehouseId } : {},
  });
  const data = res.data as PosCatalog;
  await posCatalogCache.set(catalogKey(warehouseId), data);
  return data;
}

export async function getCachedCatalog(
  warehouseId?: string,
): Promise<PosCatalog | null> {
  return posCatalogCache.get<PosCatalog>(catalogKey(warehouseId), CATALOG_TTL_MS);
}

const norm = (s: any) => (s ?? '').toString().toLowerCase();

export function filterProducts(
  products: any[] | undefined | null,
  query: string,
  limit = 10,
): any[] {
  const q = norm(query).trim();
  if (!q || !Array.isArray(products)) return [];
  return products
    .filter(
      (p) =>
        norm(p.name).includes(q) ||
        norm(p.sku).includes(q) ||
        norm(p.barcode).includes(q),
    )
    .slice(0, limit);
}

export function filterCustomers(
  customers: any[] | undefined | null,
  query: string,
  limit = 10,
): any[] {
  const q = norm(query).trim();
  if (!q || !Array.isArray(customers)) return [];
  return customers
    .filter(
      (c) =>
        norm(c.name).includes(q) ||
        norm(c.phone).includes(q) ||
        norm(c.email).includes(q) ||
        norm(c.customerCode).includes(q),
    )
    .slice(0, limit);
}
