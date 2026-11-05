import { serviceOutbox } from '@/lib/offline-db';
import { serviceOrdersService } from '@/services/service-orders.service';

export interface IntakeSyncResult {
  synced: number;
  failed: number;
  errors: Array<{ clientMutationId: string; provisionalRef: string; error: string }>;
  remapped: Array<{ clientMutationId: string; orderId: string; serviceNumber: string }>;
}

/**
 * IGDERP-240: push queued Smart Repair intakes to the server.
 * Idempotent — server dedupes by clientMutationId, so retries are safe.
 * Two-phase: create order first, then upload photos (resumable via
 * photos-pending status if the app dies mid-upload).
 */
export async function syncPendingIntakes(): Promise<IntakeSyncResult> {
  const result: IntakeSyncResult = { synced: 0, failed: 0, errors: [], remapped: [] };
  const queued = (await serviceOutbox.list()).filter((p) => p.status !== 'failed');

  for (const intake of queued) {
    try {
      // Phase 1: create (skipped if a previous attempt already created it)
      let orderId = intake.orderId;
      let serviceNumber = intake.serviceNumber;
      if (!orderId) {
        const order = await serviceOrdersService.createSmartRepair(intake.payload);
        orderId = order?.id;
        serviceNumber = order?.serviceNumber || order?.service_number;
        if (!orderId) throw new Error('order created without id');
        await serviceOutbox.patch(intake.clientMutationId, {
          orderId,
          serviceNumber,
          status: 'photos-pending',
        });
      }
      // Phase 2: photos (resumable)
      if (intake.photoBlobs.length > 0) {
        const files = intake.photoBlobs.map(
          (b, i) => new File([b], `offline-${intake.clientMutationId.slice(0, 8)}-${i + 1}.jpg`, { type: b.type || 'image/jpeg' }),
        );
        await serviceOrdersService.uploadPhotoFiles(orderId!, files, 'intake');
      }
      await serviceOutbox.remove(intake.clientMutationId);
      result.synced += 1;
      result.remapped.push({
        clientMutationId: intake.clientMutationId,
        orderId: orderId!,
        serviceNumber: serviceNumber || '',
      });
      try {
        const map = JSON.parse(localStorage.getItem('sr-offline-remap') || '{}');
        map[intake.clientMutationId] = { provisionalRef: intake.provisionalRef, orderId, serviceNumber };
        localStorage.setItem('sr-offline-remap', JSON.stringify(map));
      } catch {
        // remap cache is best-effort
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || 'sync gagal';
      // IGDERP-241/D4: 401 that survives silent refresh means the login redirect
      // fires from the interceptor — keep queued (don't park as failed).
      if (status === 401) {
        await serviceOutbox.patch(intake.clientMutationId, { attempts: intake.attempts + 1 });
        result.failed += 1;
        result.errors.push({
          clientMutationId: intake.clientMutationId,
          provisionalRef: intake.provisionalRef,
          error: 'Sesi berakhir — login lalu sync ulang',
        });
        continue;
      }
      const valErr = status >= 400 && status < 500;
      // Validation errors (e.g. parts exceed stock) need review — park, don't retry blindly
      if (valErr && !intake.orderId) {
        await serviceOutbox.patch(intake.clientMutationId, {
          status: 'failed',
          lastError: Array.isArray(msg) ? msg.join(', ') : msg,
          attempts: intake.attempts + 1,
        });
      } else {
        await serviceOutbox.patch(intake.clientMutationId, { attempts: intake.attempts + 1 });
      }
      result.failed += 1;
      result.errors.push({
        clientMutationId: intake.clientMutationId,
        provisionalRef: intake.provisionalRef,
        error: Array.isArray(msg) ? msg.join(', ') : msg,
      });
    }
  }

  return result;
}
