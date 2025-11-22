import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, FileText, CheckCircle, XCircle, Package, AlertCircle, Loader2, Eye } from 'lucide-react';
import { purchasingService } from '@/services/purchasing.service';
import { formatCurrency, formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [approveNotes, setApproveNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => purchasingService.getPurchaseOrder(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: (notes?: string) => purchasingService.approvePurchaseOrder(id!, notes),
    onSuccess: () => {
      toast.success('Purchase order berhasil disetujui');
      setApproveModalOpen(false);
      setApproveNotes('');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui purchase order');
    },
  });

  const orderMutation = useMutation({
    mutationFn: () => purchasingService.orderPurchaseOrder(id!),
    onSuccess: () => {
      toast.success('Purchase order berhasil ditandai sebagai ordered');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menandai purchase order');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason?: string) => purchasingService.cancelPurchaseOrder(id!, reason),
    onSuccess: () => {
      toast.success('Purchase order berhasil dibatalkan');
      setCancelModalOpen(false);
      setCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      navigate('/purchasing/po');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan purchase order');
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Draft</span>;
      case 'pending':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Pending</span>;
      case 'approved':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Approved</span>;
      case 'ordered':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Ordered</span>;
      case 'partially_received':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Partially Received</span>;
      case 'received':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Received</span>;
      case 'cancelled':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Cancelled</span>;
      default:
        return null;
    }
  };

  const canApprove = (userRoles.includes('CSO') || userRoles.includes('CFO') || userRoles.includes('OWNER')) && 
    (po?.status === 'draft' || po?.status === 'pending');
  const canOrder = po?.status === 'approved' && (userRoles.includes('CSO') || userRoles.includes('SPV') || userRoles.includes('HS'));
  const canCancel = po?.status !== 'received' && po?.status !== 'cancelled';

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Gagal memuat purchase order</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/purchasing/po"
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <FileText className="w-10 h-10" />
                {po.poNumber}
              </h1>
              <p className="text-primary-100 text-lg">{getStatusBadge(po.status)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canApprove && (
              <button
                onClick={() => setApproveModalOpen(true)}
                disabled={approveMutation.isPending}
                className="px-4 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5 inline mr-2" />
                Approve
              </button>
            )}
            {canOrder && (
              <button
                onClick={() => orderMutation.mutate()}
                disabled={orderMutation.isPending}
                className="px-4 py-2 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors disabled:opacity-50"
              >
                <Package className="w-5 h-5 inline mr-2" />
                Mark as Ordered
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
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Supplier</h3>
          <p className="text-lg font-bold text-gray-900">{po.supplier?.name || 'N/A'}</p>
          <p className="text-sm text-gray-500">{po.supplier?.customerCode}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Tanggal Order</h3>
          <p className="text-lg font-bold text-gray-900">{formatDate(po.orderDate)}</p>
          {po.expectedDeliveryDate && (
            <p className="text-sm text-gray-500">ETA: {formatDate(po.expectedDeliveryDate)}</p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Total Amount</h3>
          <p className="text-2xl font-bold text-primary-600">{formatCurrency(po.totalAmount)}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Ordered</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Qty Received</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Unit Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {po.items?.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{item.product?.name || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{item.product?.sku}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-900">{item.quantityOrdered}</td>
                  <td className="px-6 py-4 text-gray-900">{item.quantityReceived}</td>
                  <td className="px-6 py-4 text-gray-900">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-700">
                  Subtotal
                </td>
                <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(po.subtotal)}</td>
              </tr>
              {po.discountAmount > 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-700">
                    Discount
                  </td>
                  <td className="px-6 py-4 font-bold text-red-600">-{formatCurrency(po.discountAmount)}</td>
                </tr>
              )}
              {po.taxAmount > 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-700">
                    Tax
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(po.taxAmount)}</td>
                </tr>
              )}
              {po.shippingCost > 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-semibold text-gray-700">
                    Shipping
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">{formatCurrency(po.shippingCost)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="px-6 py-4 text-right font-bold text-lg text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 font-bold text-2xl text-primary-600">{formatCurrency(po.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Goods Receipts */}
      {po.goodsReceipts && po.goodsReceipts.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Goods Receipts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">GR Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {po.goodsReceipts.map((gr) => (
                  <tr key={gr.id}>
                    <td className="px-6 py-4 font-mono text-sm">{gr.grNumber}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(gr.receiptDate)}</td>
                    <td className="px-6 py-4">{getStatusBadge(gr.status)}</td>
                    <td className="px-6 py-4">
                      <Link
                        to={`/purchasing/goods-receipt/${gr.id}`}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        <Eye className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {po.notes && (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Notes</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}

      {/* Approve Modal */}
      <Modal
        open={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setApproveNotes('');
        }}
        title="Setujui Purchase Order"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-blue-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-700">
                Apakah Anda yakin ingin menyetujui Purchase Order <strong>{po.poNumber}</strong>?
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Catatan Approval (Opsional)
            </label>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder="Tambahkan catatan jika diperlukan..."
              rows={3}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setApproveModalOpen(false);
                setApproveNotes('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => {
                approveMutation.mutate(approveNotes || undefined);
              }}
              disabled={approveMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Menyetujui...' : 'Ya, Setujui'}
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
        title="Batalkan Purchase Order"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-700">
                Apakah Anda yakin ingin membatalkan Purchase Order <strong>{po.poNumber}</strong>?
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

