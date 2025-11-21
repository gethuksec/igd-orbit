import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Loader2,
  DollarSign,
  Warehouse,
  Download,
  CheckCircle,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { useBranchStore } from '@/stores/branchStore';
import { api } from '@/services/api';

export default function LowStockAlerts() {
  const { currentBranchId } = useBranchStore();
  const [selectedBranch, setSelectedBranch] = useState<string>(currentBranchId || 'ALL');

  const { data: alerts, isLoading, error } = useQuery({
    queryKey: ['low-stock-alerts', selectedBranch],
    queryFn: () => inventoryService.getLowStockAlerts(selectedBranch !== 'ALL' ? selectedBranch : undefined),
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleExport = () => {
    if (!alerts?.items || alerts.items.length === 0) {
      return;
    }

    const csv = [
      ['Produk', 'SKU', 'Cabang', 'Stok Tersedia', 'Reorder Point', 'Saran Order', 'Estimasi Biaya'].join(','),
      ...alerts.items.map((item: any) =>
        [
          `"${item.product?.name || ''}"`,
          `"${item.product?.sku || ''}"`,
          `"${item.branch?.name || ''}"`,
          item.quantityAvailable,
          item.reorderPoint,
          item.suggestedOrderQuantity,
          item.estimatedCost,
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `low-stock-alerts-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Peringatan Stok Rendah</h1>
            <p className="text-red-100 text-lg">Produk dengan stok di bawah reorder point</p>
          </div>
          {alerts && alerts.items.length > 0 && (
            <button
              onClick={handleExport}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-all flex items-center gap-2 backdrop-blur-sm"
            >
              <Download className="w-5 h-5" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Stats */}
      {alerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Alert</span>
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{alerts.totalAlerts || 0}</h3>
            <p className="text-xs text-gray-500 mt-1">Produk perlu restock</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Cabang</span>
              <Warehouse className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900">
              {Object.keys(alerts.byBranch || {}).length}
            </h3>
            <p className="text-xs text-gray-500 mt-1">Cabang terpengaruh</p>
          </div>
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Estimasi Biaya</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              {formatCurrency(
                alerts.items?.reduce((sum: number, item: any) => sum + (item.estimatedCost || 0), 0) || 0,
              )}
            </h3>
            <p className="text-xs text-gray-500 mt-1">Untuk restock semua</p>
          </div>
        </div>
      )}

      {/* Branch Filter */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Filter Cabang:</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="ALL">Semua Cabang</option>
            {branches?.map((branch: any) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerts by Branch */}
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">Memuat data peringatan...</p>
        </div>
      ) : alerts && alerts.items && alerts.items.length > 0 ? (
        Object.entries(alerts.byBranch || {}).map(([branchName, items]: [string, any]) => (
          <div key={branchName} className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-primary-600" />
              {branchName} ({items.length} item)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Produk</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                      Stok Tersedia
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                      Reorder Point
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                      Saran Order
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                      Estimasi Biaya
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.product?.name || '-'}
                            </div>
                            <div className="text-xs text-gray-500">SKU: {item.product?.sku || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-red-600">{item.quantityAvailable}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-gray-900">{item.reorderPoint}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-blue-600">
                          {item.suggestedOrderQuantity}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.estimatedCost || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/products/${item.productId}`}
                          className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
                        >
                          Lihat Produk
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-green-100 rounded-full">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <p className="text-gray-600 font-semibold text-lg">Tidak ada peringatan stok rendah</p>
            <p className="text-sm text-gray-500">Semua produk memiliki stok yang cukup</p>
          </div>
        </div>
      )}
    </div>
  );
}

