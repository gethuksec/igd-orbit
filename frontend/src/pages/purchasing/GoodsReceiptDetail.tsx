import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { purchasingService } from '@/services/purchasing.service';
import { formatDate, formatCurrency } from '@/utils/format';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';

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
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [approveData, setApproveData] = useState({
    inspection_status: 'passed' as 'passed' | 'failed' | 'partial',
    inspection_notes: '',
    notes: '',
  });
  const [cancelReason, setCancelReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const { data: gr, isLoading, error } = useQuery({
    queryKey: ['goods-receipt', id],
    queryFn: () => purchasingService.getGoodsReceipt(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: (data?: any) => purchasingService.approveGoodsReceipt(id!, data),
    onSuccess: () => {
      toast.success('Goods receipt berhasil disetujui');
      setApproveModalOpen(false);
      setApproveData({ inspection_status: 'passed', inspection_notes: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui goods receipt');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchasingService.rejectGoodsReceipt(id!, reason),
    onSuccess: () => {
      toast.success('Goods receipt berhasil ditolak');
      setRejectModalOpen(false);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menolak goods receipt');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => purchasingService.cancelGoodsReceipt(id!, reason),
    onSuccess: () => {
      toast.success('Goods receipt berhasil dibatalkan');
      setCancelModalOpen(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['goods-receipt', id] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan goods receipt');
    },
  });

  const canApprove = ['HS', 'SPV', 'CSO', 'OWNER'].some((r) => userRoles.includes(r)) &&
    (gr?.status === 'draft' || gr?.status === 'received' || gr?.status === 'inspected');
  const canReject = ['HS', 'SPV', 'CSO', 'OWNER'].some((r) => userRoles.includes(r)) &&
    gr?.status !== 'approved' && gr?.status !== 'rejected' && gr?.status !== 'cancelled';
  const canCancel = gr?.status !== 'approved' && gr?.status !== 'cancelled';

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
            : gr.status === 'approved' ? 'Approved'
            : gr.status === 'rejected' ? 'Rejected'
            : gr.status === 'cancelled' ? 'Cancelled'
            : ''
        }
      >
        <div className="flex gap-2">
          
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
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Received</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Accepted</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Rejected</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {gr.items?.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{item.product?.name || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{item.product?.sku}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{item.quantityReceived}</td>
                  <td className="px-6 py-4 text-green-600 font-semibold">{item.quantityAccepted}</td>
                  <td className="px-6 py-4 text-red-600 font-semibold">{item.quantityRejected}</td>
                  <td className="px-6 py-4 text-gray-900">{formatCurrency(item.unitPrice)}</td>
                </tr>
              ))}
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

      {/* Approve Modal */}
      <Modal
        open={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setApproveData({ inspection_status: 'passed', inspection_notes: '', notes: '' });
        }}
        title="Setujui Goods Receipt"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-700">
                Apakah Anda yakin ingin menyetujui Goods Receipt <strong>{gr.grNumber}</strong>?
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Status Inspeksi *
            </label>
            <select
              value={approveData.inspection_status}
              onChange={(e) => setApproveData({ ...approveData, inspection_status: e.target.value as any })}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="passed">Passed</option>
              <option value="partial">Partial</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Catatan Inspeksi
            </label>
            <textarea
              value={approveData.inspection_notes}
              onChange={(e) => setApproveData({ ...approveData, inspection_notes: e.target.value })}
              placeholder="Tambahkan catatan inspeksi..."
              rows={3}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Catatan (Opsional)
            </label>
            <textarea
              value={approveData.notes}
              onChange={(e) => setApproveData({ ...approveData, notes: e.target.value })}
              placeholder="Tambahkan catatan jika diperlukan..."
              rows={2}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setApproveModalOpen(false);
                setApproveData({ inspection_status: 'passed', inspection_notes: '', notes: '' });
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => {
                approveMutation.mutate(approveData);
              }}
              disabled={approveMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Menyetujui...' : 'Ya, Setujui'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectReason('');
        }}
        title="Tolak Goods Receipt"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-orange-100 rounded-full">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-700">
                Apakah Anda yakin ingin menolak Goods Receipt <strong>{gr.grNumber}</strong>?
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Alasan Penolakan *
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Masukkan alasan penolakan..."
              rows={3}
              required
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setRejectModalOpen(false);
                setRejectReason('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('Alasan penolakan harus diisi');
                  return;
                }
                rejectMutation.mutate(rejectReason);
              }}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Menolak...' : 'Ya, Tolak'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelReason('');
        }}
        title="Batalkan Goods Receipt"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-700">
                Apakah Anda yakin ingin membatalkan Goods Receipt <strong>{gr.grNumber}</strong>?
              </p>
              <p className="text-sm text-gray-500 mt-1">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Alasan Pembatalan *
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Masukkan alasan pembatalan..."
              rows={3}
              required
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setCancelModalOpen(false);
                setCancelReason('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (!cancelReason.trim()) {
                  toast.error('Alasan pembatalan harus diisi');
                  return;
                }
                cancelMutation.mutate(cancelReason);
              }}
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Membatalkan...' : 'Ya, Batalkan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

