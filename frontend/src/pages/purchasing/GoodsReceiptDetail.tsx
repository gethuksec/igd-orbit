import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  History,
  CheckCheck,
} from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { purchasingService } from '@/services/purchasing.service';
import { formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import AttachmentPanel from '@/components/purchasing/AttachmentPanel';

const PROCESSOR_ROLES = ['SODO', 'HS', 'SPV', 'SUPERADMIN', 'OWNER', 'CFO', 'MGR'];
const ACTION_LABEL: Record<string, string> = {
  created: 'Dibuat',
  received: 'Diterima',
  inspected: 'Inspeksi',
  revisit: 'Revisit',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};
const REVISIT_REASONS = [
  'Kuantitas tidak sesuai — tunggu konfirmasi supplier',
  'Data item / harga salah',
  'Dokumen invoice belum lengkap',
  'Lainnya (tulis di catatan)',
];

export default function GoodsReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const getCurrentUser = () => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const currentUser = getCurrentUser();
  const userRoles: string[] = currentUser?.roles || (currentUser?.role?.code ? [currentUser.role.code] : []);
  const userId = currentUser?.id || '';
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [revisitModalOpen, setRevisitModalOpen] = useState(false);
  const [approveData, setApproveData] = useState({
    inspection_status: 'passed' as 'passed' | 'failed' | 'partial',
    inspection_notes: '',
    notes: '',
  });
  const [cancelReason, setCancelReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [revisitReason, setRevisitReason] = useState(REVISIT_REASONS[0]);
  const [revisitNote, setRevisitNote] = useState('');

  const { data: gr, isLoading, error } = useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: () => purchasingService.getGoodsReceipt(id!),
    enabled: !!id,
  });

  // Receiving rows state (editable in draft/received/revisit)
  const [receiving, setReceiving] = useState<Record<string, { received: number; rejected: number }>>({});
  const [checkAll, setCheckAll] = useState(false);
  const isEditingStatus = gr && ['draft', 'received', 'revisit'].includes(gr.status);
  const canEditReceiving =
    !!gr &&
    isEditingStatus &&
    (gr.receivedBy === userId || PROCESSOR_ROLES.some((r) => userRoles.includes(r)));

  const approveMutation = useMutation({
    mutationFn: (data?: any) => purchasingService.approveGoodsReceipt(id!, data),
    onSuccess: () => {
      toast.success('Goods receipt disetujui');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setApproveModalOpen(false);
      setApproveData({ inspection_status: 'passed', inspection_notes: '', notes: '' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchasingService.rejectGoodsReceipt(id!, reason),
    onSuccess: () => {
      toast.success('Goods receipt ditolak');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setRejectModalOpen(false);
      setRejectReason('');
    },
  });

  const revisitMutation = useMutation({
    mutationFn: (reason: string) => purchasingService.revisitGoodsReceipt(id!, reason),
    onSuccess: () => {
      toast.success('GR dikembalikan ke SODO');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setRevisitModalOpen(false);
      setRevisitNote('');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => purchasingService.cancelGoodsReceipt(id!, reason),
    onSuccess: () => {
      toast.success('Goods receipt dibatalkan');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setCancelModalOpen(false);
      setCancelReason('');
    },
  });

  const receivingMutation = useMutation({
    mutationFn: (items: Array<{ id: string; quantity_received: number; quantity_rejected: number }>) =>
      purchasingService.updateGoodsReceiptReceiving(id!, items),
    onSuccess: () => {
      toast.success('Penerimaan tersimpan');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      setCheckAll(false);
      setReceiving({});
    },
  });

  const orderedFor = (item: any): number | null => {
    if (!gr?.purchaseOrder?.items || !item.purchaseOrderItemId) return null;
    const poItem = gr.purchaseOrder.items.find((i: any) => i.id === item.purchaseOrderItemId);
    return poItem ? Number(poItem.quantityOrdered) : null;
  };

  const rowValue = (item: any) => {
    const over = receiving[item.id];
    const received = over ? over.received : Number(item.quantityReceived);
    const rejected = over ? over.rejected : Number(item.quantityRejected);
    const accepted = received - rejected;
    const ordered = orderedFor(item);
    const isMismatch = ordered !== null && received !== ordered;
    const variancePct = ordered && ordered > 0 ? Math.round(((received - ordered) / ordered) * 100) : 0;
    return { received, rejected, accepted, ordered, isMismatch, variancePct };
  };

  const handleCheckAll = (checked: boolean) => {
    setCheckAll(checked);
    if (!gr) return;
    const next: typeof receiving = {};
    (gr.items ?? []).forEach((item: any) => {
      const ordered = orderedFor(item);
      next[item.id] = {
        received: ordered ?? Number(item.quantityReceived),
        rejected: 0,
      };
    });
    setReceiving(next);
  };

  const handleSaveReceiving = () => {
    if (!gr) return;
    const items = (gr.items ?? []).map((item: any) => ({
      id: item.id,
      quantity_received: rowValue(item).received,
      quantity_rejected: rowValue(item).rejected,
    }));
    receivingMutation.mutate(items);
  };

  const canApprove = gr && ['draft', 'received', 'inspected'].includes(gr.status);
  const canReject = gr && gr.status !== 'approved' && gr.status !== 'rejected' && gr.status !== 'cancelled';
  const canRevisit = gr && ['draft', 'received', 'inspected'].includes(gr.status);
  const canCancel = gr && gr.status !== 'approved' && gr.status !== 'cancelled';

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error || !gr) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Gagal memuat goods receipt</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <BreadcrumbHeader
        title={gr.grNumber}
        subtitle={
          gr.status === 'draft' ? 'Draft'
            : gr.status === 'received' ? 'Received'
            : gr.status === 'inspected' ? 'Inspected'
            : gr.status === 'revisit' ? 'Revisited — menunggu SODO'
            : gr.status === 'approved' ? 'Approved'
            : gr.status === 'rejected' ? 'Rejected'
            : gr.status === 'cancelled' ? 'Cancelled'
            : ''
        }
      >
        <div className="flex gap-2 flex-wrap">
          {canRevisit && (
            <button
              onClick={() => setRevisitModalOpen(true)}
              disabled={revisitMutation.isPending}
              className="px-4 py-2 bg-white text-orange-600 border border-orange-300 rounded-lg font-semibold hover:bg-orange-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-5 h-5 inline mr-2" />
              Revisit
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => setApproveModalOpen(true)}
              disabled={approveMutation.isPending}
              className="px-4 py-2 bg-white text-primary-600 border border-gray-200 rounded-lg font-semibold hover:bg-primary-50 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="w-5 h-5 inline mr-2" />
              Approve
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setRejectModalOpen(true)}
              disabled={rejectMutation.isPending}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-5 h-5 inline mr-2" />
              Reject
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setCancelModalOpen(true)}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <XCircle className="w-5 h-5 inline mr-2" />
              Cancel
            </button>
          )}
        </div>
      </BreadcrumbHeader>

      {gr.status === 'revisit' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <b>Revisit:</b> GR dikembalikan ke tim penerimaan (SODO). Periksa &amp; simpan ulang
          kuantitas penerimaan, lalu GR kembali ke status <b>Received</b> untuk approval.
          {gr.revisitReason && <div className="mt-1 text-amber-700">Alasan: “{gr.revisitReason}”</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Purchase Order</h3>
          {gr.purchaseOrder ? (
            <Link
              to={`/purchasing/po/${gr.purchaseOrderId}`}
              className="text-lg font-bold text-primary-600 hover:underline"
            >
              {gr.purchaseOrder.poNumber}
            </Link>
          ) : (
            <p className="text-lg font-bold text-gray-500">-</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Tanggal Receipt</h3>
          <p className="text-lg font-bold text-gray-900">{formatDate(gr.receiptDate)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Variance</h3>
          <p className="text-lg font-bold text-gray-900">
            {gr.variancePercent !== null && gr.variancePercent !== undefined
              ? `${gr.variancePercent.toFixed(2)}%`
              : '-'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl font-bold text-gray-900">Items</h2>
          {canEditReceiving && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkAll}
                  onChange={(e) => handleCheckAll(e.target.checked)}
                  className="w-4 h-4 accent-red-600"
                />
                Check All (qty = yang dipesan)
              </label>
              <button
                onClick={handleSaveReceiving}
                disabled={receivingMutation.isPending}
                className="px-4 py-2 bg-white text-primary-600 border border-gray-200 rounded-lg font-semibold hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-4 h-4 inline mr-1" />
                {receivingMutation.isPending ? 'Menyimpan…' : 'Simpan Penerimaan'}
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Dipesan</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Diterima</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Ditolak</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Accepted</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {gr.items?.map((item: any) => {
                const v = rowValue(item);
                return (
                  <tr key={item.id} className={v.isMismatch ? 'bg-amber-50/50' : ''}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{item.product?.name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{item.product?.sku}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-900">{v.ordered ?? '-'}</td>
                    <td className="px-6 py-4">
                      {canEditReceiving ? (
                        <input
                          type="number"
                          min={0}
                          value={v.received}
                          onChange={(e) =>
                            setReceiving((prev) => ({
                              ...prev,
                              [item.id]: {
                                received: Math.max(0, Number(e.target.value)),
                                rejected: (prev[item.id]?.rejected ?? Number(item.quantityRejected)),
                              },
                            }))
                          }
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      ) : (
                        <span className="text-gray-900">{v.received}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {canEditReceiving ? (
                        <input
                          type="number"
                          min={0}
                          max={v.received}
                          value={v.rejected}
                          onChange={(e) =>
                            setReceiving((prev) => ({
                              ...prev,
                              [item.id]: {
                                received: prev[item.id]?.received ?? Number(item.quantityReceived),
                                rejected: Math.max(0, Math.min(Number(e.target.value), (prev[item.id]?.received ?? Number(item.quantityReceived)))),
                              },
                            }))
                          }
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      ) : (
                        <span className="text-red-600 font-semibold">{v.rejected}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-green-600 font-semibold">{v.accepted}</td>
                    <td className="px-6 py-4">
                      {v.ordered === null ? (
                        <span className="text-sm text-gray-500">-</span>
                      ) : v.isMismatch ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          {v.variancePct > 0 ? '+' : ''}
                          {v.variancePct}% · selisih
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Sesuai (0%)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {gr.notes && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Notes</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{gr.notes}</p>
        </div>
      )}

      {/* IGDERP-81: documents (invoice supplier / surat jalan) on GR */}
      <AttachmentPanel entityType="GOODS_RECEIPT" entityId={gr.id} title="Lampiran Dokumen Penerimaan" />

      {/* IGDERP-80: audit trail (append-only) */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-bold text-gray-900">Riwayat</h3>
        </div>
        {gr.events && gr.events.length > 0 ? (
          <ul className="space-y-3">
            {gr.events.map((ev: any) => (
              <li key={ev.id} className="flex gap-3">
                <div className="flex-none w-2 h-2 rounded-full bg-primary-600 mt-2" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {ACTION_LABEL[ev.action] || ev.action} · {ev.actor?.fullName || ev.actor?.email || '-'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(ev.createdAt).toLocaleString('id-ID')}
                  </div>
                  {ev.note && <div className="text-sm text-gray-600 mt-0.5">{ev.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Belum ada riwayat.</p>
        )}
      </div>

      {/* Approve modal */}
      <Modal open={approveModalOpen} onClose={() => setApproveModalOpen(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Approve Goods Receipt</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Hasil Inspeksi</label>
            <div className="flex gap-4 mt-1">
              {(['passed', 'failed', 'partial'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="inspection_status"
                    checked={approveData.inspection_status === s}
                    onChange={() => setApproveData({ ...approveData, inspection_status: s })}
                    className="accent-red-600"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Catatan Inspeksi</label>
            <textarea
              value={approveData.inspection_notes}
              onChange={(e) => setApproveData({ ...approveData, inspection_notes: e.target.value })}
              placeholder="Contoh: 2 busi pecah saat pengiriman…"
              className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Catatan Umum</label>
            <textarea
              value={approveData.notes}
              onChange={(e) => setApproveData({ ...approveData, notes: e.target.value })}
              placeholder="Catatan tambahan (opsional)"
              className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm"
            />
          </div>
          <p className="text-sm text-gray-500">
            Stok masuk ke <b>central-good</b>; qty ditolak otomatis ke <b>central-bad</b> (Gudang Pusat).
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setApproveModalOpen(false)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600"
          >
            Batal
          </button>
          <button
            onClick={() => approveMutation.mutate(approveData)}
            disabled={approveMutation.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            Setujui &amp; Masukkan Stok
          </button>
        </div>
      </Modal>

      {/* Revisit modal */}
      <Modal open={revisitModalOpen} onClose={() => setRevisitModalOpen(false)}>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Revisit — Kembalikan ke SODO</h2>
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-700">Alasan</label>
          {REVISIT_REASONS.map((r) => (
            <label
              key={r}
              className="flex items-start gap-2 text-sm text-gray-700 border border-gray-200 rounded-lg p-2 cursor-pointer"
            >
              <input
                type="radio"
                name="revisit_reason"
                checked={revisitReason === r}
                onChange={() => setRevisitReason(r)}
                className="mt-0.5 accent-orange-500"
              />
              {r}
            </label>
          ))}
          <div>
            <label className="text-sm font-semibold text-gray-700">Catatan (wajib)</label>
            <textarea
              value={revisitNote}
              onChange={(e) => setRevisitNote(e.target.value)}
              placeholder="Detail alasan…"
              className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm"
            />
          </div>
          <p className="text-sm text-gray-500">
            GR kembali ke status <b>Received</b> dan dapat diedit oleh SODO. Record inspeksi tetap tersimpan.
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setRevisitModalOpen(false)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600"
          >
            Batal
          </button>
          <button
            onClick={() => revisitMutation.mutate(revisitNote || revisitReason)}
            disabled={revisitMutation.isPending || !revisitNote.trim()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            Kembalikan ke SODO
          </button>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal open={rejectModalOpen} onClose={() => setRejectModalOpen(false)}>
        <h2 className="text-xl font-bold text-red-600 mb-4">Reject Goods Receipt</h2>
        <div>
          <label className="text-sm font-semibold text-gray-700">Alasan penolakan (wajib)</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Alasan…"
            className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm"
          />
        </div>
        <p className="text-sm text-gray-500 mt-3">GR ditolak final — stok TIDAK akan masuk.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setRejectModalOpen(false)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600"
          >
            Batal
          </button>
          <button
            onClick={() => rejectMutation.mutate(rejectReason)}
            disabled={rejectMutation.isPending || !rejectReason.trim()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </Modal>

      {/* Cancel modal */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)}>
        <h2 className="text-xl font-bold text-red-600 mb-4">Cancel Goods Receipt</h2>
        <div>
          <label className="text-sm font-semibold text-gray-700">Alasan (opsional)</label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Alasan pembatalan…"
            className="mt-1 w-full border border-gray-200 rounded-lg p-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => setCancelModalOpen(false)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600"
          >
            Batal
          </button>
          <button
            onClick={() => cancelMutation.mutate(cancelReason)}
            disabled={cancelMutation.isPending}
            className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
