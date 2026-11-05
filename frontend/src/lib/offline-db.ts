// IGDERP-239: minimal IndexedDB wrapper for PoS offline outbox + catalog cache.
// IGDERP-240: extended with service intake outbox (payload + photo blobs) + draft.
// No external deps (dexie not in bundle) — promise wrapper over raw IndexedDB.

const DB_NAME = 'igd-pos-offline';
const DB_VERSION = 2;

export interface PendingSale {
  clientMutationId: string;
  payload: any;
  provisionalNumber: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'failed';
  // IGDERP-241 (D5): display snapshot for offline print-from-queue.
  // Never sent to the server — sync workers only POST `payload`.
  snapshot?: PendingSaleSnapshot;
}

// IGDERP-241 (D5): frozen display data for the provisional thermal receipt.
export interface PendingSaleSnapshot {
  storeName: string;
  branchName?: string;
  cashierName?: string;
  customerName?: string;
  items: { name: string; sku?: string; quantity: number; unitPrice: number; discountAmount?: number }[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  createdAt: number;
}

export interface CatalogCache {
  key: string;
  data: any;
  cachedAt: number;
}

// IGDERP-240: queued Smart Repair intake. Photos ride along as Blobs
// (structured-clone safe). orderId set after create so photo-only retries
// don't recreate the order.
export interface PendingIntake {
  clientMutationId: string;
  payload: any;
  photoBlobs: Blob[];
  provisionalRef: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'photos-pending' | 'failed';
  orderId?: string;
  serviceNumber?: string;
}

// IGDERP-240: in-progress intake draft (form survives reload; photos included).
export interface ServiceDraft {
  key: string;
  form: any;
  rows: any[];
  selectedLayanan: string[];
  checklist: any[];
  layananCost: Record<string, number>;
  layananNotes: Record<string, string[]>;
  photoBlobs: Blob[];
  savedAt: number;
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
      // IGDERP-240
      if (!db.objectStoreNames.contains('service-outbox')) {
        db.createObjectStore('service-outbox', { keyPath: 'clientMutationId' });
      }
      if (!db.objectStoreNames.contains('service-draft')) {
        db.createObjectStore('service-draft', { keyPath: 'key' });
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

export const serviceOutbox = {
  async add(intake: PendingIntake): Promise<void> {
    await tx('service-outbox', 'readwrite', (s) => s.put(intake));
  },
  async list(): Promise<PendingIntake[]> {
    try {
      return await tx('service-outbox', 'readonly', (s) => s.getAll());
    } catch {
      return [];
    }
  },
  async remove(clientMutationId: string): Promise<void> {
    await tx('service-outbox', 'readwrite', (s) => s.delete(clientMutationId));
  },
  async patch(clientMutationId: string, patch: Partial<PendingIntake>): Promise<void> {
    const all = await serviceOutbox.list();
    const cur = all.find((p) => p.clientMutationId === clientMutationId);
    if (cur) await serviceOutbox.add({ ...cur, ...patch });
  },
  async count(): Promise<number> {
    const all = await serviceOutbox.list();
    return all.filter((p) => p.status === 'pending' || p.status === 'photos-pending').length;
  },
};

export const serviceDraftStore = {
  async save(draft: ServiceDraft): Promise<void> {
    try {
      await tx('service-draft', 'readwrite', (s) => s.put(draft));
    } catch {
      // quota — draft is best-effort
    }
  },
  async load(): Promise<ServiceDraft | null> {
    try {
      const row = await tx<ServiceDraft | undefined>('service-draft', 'readonly', (s) => s.get('current'));
      return row || null;
    } catch {
      return null;
    }
  },
  async clear(): Promise<void> {
    try {
      await tx('service-draft', 'readwrite', (s) => s.delete('current'));
    } catch {
      // ignore
    }
  },
};

export function provisionalNumber(branchCode: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OFF-${branchCode || 'TRX'}-${ymd}-${rand}`;
}

export function provisionalServiceRef(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OFF-SRV-${ymd}-${rand}`;
}

/** Downscale photos to max 1280px JPEG ~0.8 so IndexedDB + upload stay small. */
export function compressImage(file: Blob, maxDim = 1280, quality = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1 && file.type === 'image/jpeg') return resolve(file);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
