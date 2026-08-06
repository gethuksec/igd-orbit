import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  ClipboardCheck,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { toast } from 'sonner';

export default function StockOpnameDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: opname, isLoading, error } = useQuery({
    queryKey: ['inventory-opname', id],
    queryFn: () => inventoryService.getOpnameById(id!),
    enabled: !!id,
  });

  const completeMutation = useMutation({
    mutationFn: () => inventoryService.completeOpname(id!),
    onSuccess: () => {
      toast.success('Opname berhasil diselesaikan');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyelesaikan opname');
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => inventoryService.approveOpname(id!),
    onSuccess: () => {
      toast.success('Opname berhasil disetujui');
      queryClient.invalidateQueries({ queryKey: ['inventory-opname', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
      queryClient.invalidateQueries({ queryKey: ['product-stocks'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui opname');
    },
  });

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
          <p className="text-gray-600 font-semibold text-lg">Memuat data opname...</p>
        </div>
      </div>
    );
  }

  if (error || !opname) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error)?.message || 'Opname tidak ditemukan'}
          </p>
        </div>
        <Link
          to="/inventory/opname"
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
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'counting':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'counting':
        return 'Sedang Dihitung';
      case 'completed':
        return 'Selesai - Menunggu Persetujuan';
      case 'approved':
        return 'Disetujui';
      default:
        return status;
    }
  };

  const totalDiscrepancyValue = opname.totalDiscrepancyValue
    ? typeof opname.totalDiscrepancyValue === 'string'
      ? parseFloat(opname.totalDiscrepancyValue)
      : Number(opname.totalDiscrepancyValue)
    : 0;

  const countedItems = opname.items.filter((item) => item.physicalQuantity !== null).length;
  const totalItems = opname.items.length;
  const itemsWithLargeDiscrepancy = opname.items.filter((item) => {
    const systemQty = Number(item.systemQuantity);
    const discrepancy = Number(item.discrepancy || 0);
    const percentage = systemQty > 0 ? Math.abs((discrepancy / systemQty) * 100) : 0;
    return percentage > 5;
  });

  const canComplete = opname.status === 'counting' && countedItems === totalItems;
  const canApprove = opname.status === 'completed';

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <BreadcrumbHeader title={opname.opnameNumber} subtitle="Detail Stock Opname">
        <span
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${getStatusColor(
            opname.status,
          )}`}
        >
          {getStatusLabel(opname.status)}
        </span>
      </BreadcrumbHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Item</span>
            <Package className="w-5 h-5 text-primary-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{totalItems}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {countedItems} sudah dihitung ({Math.round((countedItems / totalItems) * 100)}%)
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Nilai Discrepancy</span>
            {totalDiscrepancyValue > 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : totalDiscrepancyValue < 0 ? (
              <TrendingDown className="w-5 h-5 text-red-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-gray-600" />
            )}
          </div>
          <h3
            className={`text-2xl font-bold ${
              totalDiscrepancyValue > 0
                ? 'text-green-600'
                : totalDiscrepancyValue < 0
                  ? 'text-red-600'
                  : 'text-gray-900'
            }`}
          >
            {formatCurrency(Math.abs(totalDiscrepancyValue))}
          </h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Item dengan Discrepancy</span>
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">
            {opname.items.filter((item) => Number(item.discrepancy || 0) !== 0).length}
          </h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Discrepancy {'>'} 5%</span>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-red-600">{itemsWithLargeDiscrepancy.length}</h3>
          <p className="text-xs text-gray-500 mt-1">Perlu investigasi</p>
        </div>
      </div>

      {/* Opname Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary-600" />
            Informasi Opname
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Cabang</p>
              <p className="text-base font-semibold text-gray-900">{opname.branch?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tanggal Opname</p>
              <p className="text-base font-semibold text-gray-900">
                {new Date(opname.opnameDate).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {opname.completedAt && (
              <div>
                <p className="text-sm text-gray-600">Selesai Pada</p>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(opname.completedAt).toLocaleString('id-ID')}
                </p>
              </div>
            )}
            {opname.approvedAt && (
              <div>
                <p className="text-sm text-gray-600">Disetujui Pada</p>
                <p className="text-base font-semibold text-gray-900">
                  {new Date(opname.approvedAt).toLocaleString('id-ID')}
                </p>
              </div>
            )}
            {opname.notes && (
              <div>
                <p className="text-sm text-gray-600">Catatan</p>
                <p className="text-base text-gray-900">{opname.notes}</p>
              </div>
            )}
          </div>
        </div>

        {itemsWithLargeDiscrepancy.length > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-xl shadow-md p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-yellow-900 mb-2">Peringatan</h3>
                <p className="text-sm text-yellow-800">
                  Terdapat {itemsWithLargeDiscrepancy.length} item dengan discrepancy lebih dari 5%. Harap
                  lakukan investigasi sebelum menyetujui opname ini.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items List */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Daftar Item
          </h2>
          {opname.status === 'counting' && (
            <Link
              to={`/inventory/opname/${opname.id}/count`}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Lanjutkan Menghitung
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Stok Sistem</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Stok Fisik
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Discrepancy</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Nilai Discrepancy
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Kondisi</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {opname.items.map((item) => {
                const systemQty = Number(item.systemQuantity);
                const physicalQty = Number(item.physicalQuantity || 0);
                const discrepancy = Number(item.discrepancy || 0);
                const discrepancyValue = Number(item.discrepancyValue || 0);
                const percentage = systemQty > 0 ? Math.abs((discrepancy / systemQty) * 100) : 0;
                const isLargeDiscrepancy = percentage > 5;
                const isNotCounted = item.physicalQuantity === null;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 ${
                      isLargeDiscrepancy ? 'bg-yellow-50' : isNotCounted ? 'bg-gray-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {item.product?.name || '-'}
                      </div>
                      <div className="text-xs text-gray-500">SKU: {item.product?.sku || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-sm font-semibold text-gray-900">{systemQty}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isNotCounted ? (
                        <span className="text-sm text-gray-400 italic">Belum dihitung</span>
                      ) : (
                        <div className="text-sm font-semibold text-gray-900">{physicalQty}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isNotCounted ? (
                        <span className="text-sm text-gray-400">-</span>
                      ) : (
                        <div
                          className={`text-sm font-semibold ${
                            discrepancy > 0
                              ? 'text-green-600'
                              : discrepancy < 0
                                ? 'text-red-600'
                                : 'text-gray-900'
                          }`}
                        >
                          {discrepancy > 0 ? '+' : ''}
                          {discrepancy} ({percentage.toFixed(1)}%)
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isNotCounted ? (
                        <span className="text-sm text-gray-400">-</span>
                      ) : (
                        <div
                          className={`text-sm font-semibold ${
                            discrepancyValue > 0
                              ? 'text-green-600'
                              : discrepancyValue < 0
                                ? 'text-red-600'
                                : 'text-gray-900'
                          }`}
                        >
                          {formatCurrency(Math.abs(discrepancyValue))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isNotCounted ? (
                        <span className="text-sm text-gray-400">-</span>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            item.condition === 'damaged'
                              ? 'bg-red-100 text-red-800'
                              : item.condition === 'expired'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {item.condition === 'damaged'
                            ? 'Rusak'
                            : item.condition === 'expired'
                              ? 'Kadaluarsa'
                              : 'Baik'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">{item.notes || '-'}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      {opname.status !== 'approved' && (
        <div className="flex items-center justify-end gap-3">
          {canComplete && (
            <button
              onClick={() => {
                if (confirm('Yakin ingin menyelesaikan opname ini? Pastikan semua item sudah dihitung.')) {
                  completeMutation.mutate();
                }
              }}
              disabled={completeMutation.isPending}
              className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {completeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Selesaikan</span>
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => {
                if (
                  confirm(
                    'Yakin ingin menyetujui opname ini? Stok akan disesuaikan sesuai hasil opname.',
                  )
                ) {
                  approveMutation.mutate();
                }
              }}
              disabled={approveMutation.isPending}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {approveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Setujui</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

