// IGDERP-239: minimal IndexedDB wrapper for PoS offline outbox + catalog cache.
// No external deps (dexie not in bundle) — promise wrapper over raw IndexedDB.

const DB_NAME = 'igd-pos-offline';
const DB_VERSION = 1;

export interface PendingSale {
  clientMutationId: string;
  payload: any;
  provisionalNumber: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'failed';
}

export interface CatalogCache {
  key: string;
  data: any;
  cachedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'clientMutationId' });
      }
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

export const posOutbox = {
  async add(sale: PendingSale): Promise<void> {
    await tx('outbox', 'readwrite', (s) => s.put(sale));
  },
  async list(): Promise<PendingSale[]> {
    return tx('outbox', 'readonly', (s) => s.getAll());
  },
  async remove(clientMutationId: string): Promise<void> {
    await tx('outbox', 'readwrite', (s) => s.delete(clientMutationId));
  },
  async markFailed(clientMutationId: string, error: string): Promise<void> {
    const all = await posOutbox.list();
    const sale = all.find((p) => p.clientMutationId === clientMutationId);
    if (sale) {
      await posOutbox.add({ ...sale, status: 'failed', lastError: error, attempts: sale.attempts + 1 });
    }
  },
  async bumpAttempts(clientMutationId: string): Promise<void> {
    const all = await posOutbox.list();
    const sale = all.find((p) => p.clientMutationId === clientMutationId);
    if (sale) {
      await posOutbox.add({ ...sale, attempts: sale.attempts + 1 });
    }
  },
  async count(): Promise<number> {
    const all = await posOutbox.list();
    return all.filter((p) => p.status === 'pending').length;
  },
};

export const posCatalogCache = {
  async set(key: string, data: any): Promise<void> {
    try {
      await tx('catalog', 'readwrite', (s) =>
        s.put({ key, data, cachedAt: Date.now() }),
      );
    } catch {
      // quota / private-mode — catalog cache is best-effort
    }
  },
  async get<T>(key: string, maxAgeMs = 24 * 3600 * 1000): Promise<T | null> {
    try {
      const row = await tx<CatalogCache | undefined>('catalog', 'readonly', (s) => s.get(key));
      if (!row || Date.now() - row.cachedAt > maxAgeMs) return null;
      return row.data as T;
    } catch {
      return null;
    }
  },
};

export function provisionalNumber(branchCode: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OFF-${branchCode || 'TRX'}-${ymd}-${rand}`;
}
