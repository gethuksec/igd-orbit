import { posOutbox } from '@/lib/offline-db';

export interface SyncResult {
  synced: number;
  failed: number;
  errors: Array<{ clientMutationId: string; provisionalNumber: string; error: string }>;
  remapped: Array<{ clientMutationId: string; provisionalNumber: string; transactionId: string; transactionNumber: string }>;
}

/**
 * IGDERP-239: push queued offline sales to the server.
 * Idempotent — server dedupes by clientMutationId, so retries are safe.
 * Only cash payloads are ever queued (FE gate), server accepts all methods.
 */
export async function syncPendingSales(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, errors: [], remapped: [] };
  const pending = (await posOutbox.list()).filter((p) => p.status === 'pending');
  const token = localStorage.getItem('access_token');

  for (const sale of pending) {
    try {
      const res = await fetch('/api/v1/pos/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(sale.payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = Array.isArray(err?.message) ? err.message.join(', ') : err?.message || `HTTP ${res.status}`;
        // 4xx validation (e.g. stock gone) needs cashier review — park it, don't retry blindly
        if (res.status >= 400 && res.status < 500) {
          await posOutbox.markFailed(sale.clientMutationId, msg);
          result.failed += 1;
          result.errors.push({ clientMutationId: sale.clientMutationId, provisionalNumber: sale.provisionalNumber, error: msg });
          continue;
        }
        throw new Error(msg);
      }
      const data = await res.json();
      await posOutbox.remove(sale.clientMutationId);
      result.synced += 1;
      result.remapped.push({
        clientMutationId: sale.clientMutationId,
        provisionalNumber: sale.provisionalNumber,
        transactionId: data?.id || '',
        transactionNumber: data?.transactionNumber || '',
      });
      try {
        const map = JSON.parse(localStorage.getItem('pos-offline-remap') || '{}');
        map[sale.clientMutationId] = { provisionalNumber: sale.provisionalNumber, ...data };
        localStorage.setItem('pos-offline-remap', JSON.stringify(map));
      } catch {
        // remap cache is best-effort
      }
    } catch (e: any) {
      // network / 5xx — keep queued, bump attempts, try next time
      await posOutbox.bumpAttempts(sale.clientMutationId);
      result.failed += 1;
      result.errors.push({
        clientMutationId: sale.clientMutationId,
        provisionalNumber: sale.provisionalNumber,
        error: e?.message || 'network error',
      });
    }
  }

  return result;
}
