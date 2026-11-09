import { posOutbox } from '@/lib/offline-db';
import { api } from './api';

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
 * IGDERP-241/D4: goes through the `api` instance so an expired access token
 * triggers silent refresh + retry instead of wrongly parking the sale as failed.
 *
 * `includeFailed` (manual "Sync sekarang" only): also retry sales parked as
 * failed after a 4xx. Without it a parked sale is invisible to sync — the
 * banner counts it but sync reports "Tidak ada antrean offline". Auto-sync
 * paths (online event, heartbeat) stay pending-only so validation errors
 * don't get hammered every 15s; the cashier retries them deliberately.
 */
export async function syncPendingSales(opts?: { includeFailed?: boolean }): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, errors: [], remapped: [] };
  const pending = (await posOutbox.list()).filter(
    (p) => p.status === 'pending' || (opts?.includeFailed && p.status === 'failed'),
  );

  for (const sale of pending) {
    try {
      const res = await api.post('/pos/transactions', sale.payload);
      const data = res.data?.data || res.data;
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
      const status = e?.response?.status;
      const rawMsg = e?.response?.data?.message || e?.message || 'network error';
      const msg = Array.isArray(rawMsg) ? rawMsg.join(', ') : rawMsg;
      if (status === 401) {
        // Session truly expired (silent refresh failed → login redirect fires
        // from the interceptor). Keep queued, don't park as failed.
        await posOutbox.bumpAttempts(sale.clientMutationId);
        result.failed += 1;
        result.errors.push({
          clientMutationId: sale.clientMutationId,
          provisionalNumber: sale.provisionalNumber,
          error: 'Sesi berakhir — login lalu sync ulang',
        });
        continue;
      }
      // 4xx validation (e.g. stock gone) needs cashier review — park it, don't retry blindly
      if (status >= 400 && status < 500) {
        await posOutbox.markFailed(sale.clientMutationId, msg);
        result.failed += 1;
        result.errors.push({ clientMutationId: sale.clientMutationId, provisionalNumber: sale.provisionalNumber, error: msg });
        continue;
      }
      // network / 5xx — keep queued, bump attempts, try next time
      await posOutbox.bumpAttempts(sale.clientMutationId);
      result.failed += 1;
      result.errors.push({
        clientMutationId: sale.clientMutationId,
        provisionalNumber: sale.provisionalNumber,
        error: msg,
      });
    }
  }

  return result;
}
