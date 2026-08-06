import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Truck,
  Package,
  Clock,
  Calendar,
  FileText,
  ArrowRightLeft,
  AlertCircle,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { toast } from 'sonner';

export default function StockTransferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [receivingItems, setReceivingItems] = useState<Record<string, number>>({});
  const [receivingConditions, setReceivingConditions] = useState<Record<string, 'good' | 'damaged' | 'expired'>>({});

  const { data: transfer, isLoading, error } = useQuery({
    queryKey: ['inventory-transfer', id],
    queryFn: () => inventoryService.getTransferById(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => inventoryService.approveTransfer(id!),
    onSuccess: () => {
      toast.success('Transfer berhasil disetujui');
      queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui transfer');
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => inventoryService.sendTransfer(id!),
    onSuccess: () => {
      toast.success('Transfer berhasil dikirim');
      queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengirim transfer');
    },
  });

  const receiveMutation = useMutation({
    mutationFn: () => {
      const items = transfer!.items.map((item) => ({
        itemId: item.id,
        quantityReceived: receivingItems[item.id] || item.quantitySent || item.quantityRequested,
        condition: receivingConditions[item.id] || 'good',
      }));
      return inventoryService.receiveTransfer(id!, { items });
    },
    onSuccess: () => {
      toast.success('Transfer berhasil diterima');
      queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['product-stocks'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menerima transfer');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => inventoryService.cancelTransfer(id!),
    onSuccess: () => {
      toast.success('Transfer berhasil dibatalkan');
      queryClient.invalidateQueries({ queryKey: ['inventory-transfer', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      navigate('/inventory/transfer');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan transfer');
    },
  });

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
          <p className="text-gray-600 font-semibold text-lg">Memuat data transfer...</p>
        </div>
      </div>
    );
  }

  if (error || !transfer) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error)?.message || 'Transfer tidak ditemukan'}
          </p>
        </div>
        <Link
          to="/inventory/transfer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar
        </Link>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sent':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'received':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Menunggu Persetujuan';
      case 'approved':
        return 'Disetujui';
      case 'sent':
        return 'Dikirim';
      case 'received':
        return 'Diterima';
      case 'cancelled':
        return 'Dibatalkan';
      default:
        return status;
    }
  };

  const calculateTotalValue = () => {
    return transfer.items.reduce((sum, item) => {
      const costPrice = item.product?.costPrice
        ? typeof item.product.costPrice === 'string'
          ? parseFloat(item.product.costPrice)
          : Number(item.product.costPrice)
        : 0;
      return sum + costPrice * item.quantityRequested;
    }, 0);
  };

  const canApprove = transfer.status === 'pending';
  const canSend = transfer.status === 'approved';
  const canReceive = transfer.status === 'sent';
  const canCancel = ['pending', 'approved'].includes(transfer.status);

  // Initialize receiving items
  if (canReceive && Object.keys(receivingItems).length === 0) {
    const initial: Record<string, number> = {};
    transfer.items.forEach((item) => {
      initial[item.id] = item.quantitySent || item.quantityRequested;
    });
    setReceivingItems(initial);
  }

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <BreadcrumbHeader title={transfer.transferNumber} subtitle="Detail Transfer Stok">
        <span
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(
            transfer.status,
          )}`}
        >
          {getStatusLabel(transfer.status)}
        </span>
      </BreadcrumbHeader>

      {/* Transfer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary-600" />
            Informasi Transfer
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Dari Cabang</p>
                <p className="text-base font-semibold text-gray-900">{transfer.fromBranch?.name || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Ke Cabang</p>
                <p className="text-base font-semibold text-gray-900">{transfer.toBranch?.name || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Tipe Transfer</p>
                <p className="text-base font-semibold text-gray-900">
                  {transfer.transferType === 'urgent' ? 'Urgent' : 'Regular'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Tanggal Dibuat</p>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(transfer.createdAt).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
            {transfer.notes && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-gray-400 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Catatan</p>
                  <p className="text-base text-gray-900">{transfer.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Ringkasan
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Produk</p>
              <p className="text-2xl font-bold text-gray-900">{transfer.items.length} item</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Nilai</p>
              <p className="text-2xl font-bold text-primary-600">{formatCurrency(calculateTotalValue())}</p>
            </div>
            {transfer.approvedAt && (
              <div>
                <p className="text-sm text-gray-600">Disetujui Pada</p>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(transfer.approvedAt).toLocaleString('id-ID')}
                </p>
              </div>
            )}
            {transfer.sentAt && (
              <div>
                <p className="text-sm text-gray-600">Dikirim Pada</p>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(transfer.sentAt).toLocaleString('id-ID')}
                </p>
              </div>
            )}
            {transfer.receivedAt && (
              <div>
                <p className="text-sm text-gray-600">Diterima Pada</p>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(transfer.receivedAt).toLocaleString('id-ID')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary-600" />
          Daftar Produk
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Diminta</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Dikirim</th>
                {canReceive && (
                  <>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Diterima</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Kondisi</th>
                  </>
                )}
                {transfer.status === 'received' && (
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Diterima</th>
                )}
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Harga</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transfer.items.map((item) => {
                const costPrice = item.product?.costPrice
                  ? typeof item.product.costPrice === 'string'
                    ? parseFloat(item.product.costPrice)
                    : Number(item.product.costPrice)
                  : 0;
                const quantityReceived = receivingItems[item.id] || item.quantityReceived || 0;
                const quantitySent = item.quantitySent || item.quantityRequested;
                const hasDiscrepancy = canReceive && quantityReceived !== quantitySent;

                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.product?.name || '-'}</div>
                      <div className="text-xs text-gray-500">SKU: {item.product?.sku || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-gray-900">{item.quantityRequested}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {quantitySent}
                        {item.quantitySent && item.quantitySent !== item.quantityRequested && (
                          <span className="ml-2 text-xs text-yellow-600">(discrepancy)</span>
                        )}
                      </div>
                    </td>
                    {canReceive && (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            max={quantitySent}
                            value={receivingItems[item.id] || quantitySent}
                            onChange={(e) =>
                              setReceivingItems({
                                ...receivingItems,
                                [item.id]: parseInt(e.target.value) || 0,
                              })
                            }
                            className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                          {hasDiscrepancy && (
                            <div className="mt-1 text-xs text-yellow-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Discrepancy
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={receivingConditions[item.id] || 'good'}
                            onChange={(e) =>
                              setReceivingConditions({
                                ...receivingConditions,
                                [item.id]: e.target.value as 'good' | 'damaged' | 'expired',
                              })
                            }
                            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="good">Baik</option>
                            <option value="damaged">Rusak</option>
                            <option value="expired">Kadaluarsa</option>
                          </select>
                        </td>
                      </>
                    )}
                    {transfer.status === 'received' && (
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {item.quantityReceived || 0}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm text-gray-900">{formatCurrency(costPrice)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(costPrice * item.quantityRequested)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        {canCancel && (
          <button
            onClick={() => {
              if (confirm('Yakin ingin membatalkan transfer ini?')) {
                cancelMutation.mutate();
              }
            }}
            disabled={cancelMutation.isPending}
            className="px-6 py-3 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {cancelMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            <span>Batalkan</span>
          </button>
        )}
        {canApprove && (
          <button
            onClick={() => {
              if (confirm('Yakin ingin menyetujui transfer ini?')) {
                approveMutation.mutate();
              }
            }}
            disabled={approveMutation.isPending}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {approveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>Setujui</span>
          </button>
        )}
        {canSend && (
          <button
            onClick={() => {
              if (confirm('Yakin ingin mengirim transfer ini?')) {
                sendMutation.mutate();
              }
            }}
            disabled={sendMutation.isPending}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Truck className="w-4 h-4" />
            )}
            <span>Kirim</span>
          </button>
        )}
        {canReceive && (
          <button
            onClick={() => {
              if (confirm('Yakin ingin menerima transfer ini?')) {
                receiveMutation.mutate();
              }
            }}
            disabled={receiveMutation.isPending}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {receiveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>Terima</span>
          </button>
        )}
      </div>
    </div>
  );
}

