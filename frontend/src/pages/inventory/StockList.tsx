import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, Loader2, AlertTriangle, TrendingUp, Warehouse, Filter } from 'lucide-react';
import { api } from '../../services/api';
import { useBranchStore } from '@/stores/branchStore';

export default function StockList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { availableBranches } = useBranchStore();

  // Reset page when search or branch filter changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedBranchId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product-stocks', page, searchTerm, selectedBranchId],
    queryFn: async () => {
      const response = await api.get('/inventory/stock', {
        params: {
          page,
          limit,
          search: searchTerm || undefined,
          branchId: selectedBranchId || undefined,
        },
      });
      return response.data;
    },
  });

  const stocks = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const lowStockCount = stocks.filter((s: any) => (s.quantityAvailable || 0) < (s.minStock || 0)).length;
  const totalValue = stocks.reduce(
    (acc: number, s: any) => acc + ((s.product?.costPrice || 0) * (s.quantityAvailable || 0)),
    0,
  );

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manajemen Stok</h1>
            <p className="text-primary-100 text-lg">Kelola stok produk per cabang</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl group-hover:scale-110 transition-transform">
              <Warehouse className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-primary-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Produk</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : pagination.total}</h3>
          <p className="text-xs text-gray-500">Produk dengan stok</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Nilai Stok</p>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {isLoading ? '-' : formatCurrency(totalValue)}
          </h3>
          <p className="text-xs text-gray-500">Total nilai inventori</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
              Alert
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Stok Rendah</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : lowStockCount}</h3>
          <p className="text-xs text-gray-500">Perlu restock</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari produk atau SKU..."
              className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white"
            >
              <option value="">Semua Cabang</option>
              {availableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stocks Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Cabang
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Stok Tersedia
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Min Stock
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nilai
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat data stok...</p>
                    </div>
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Package className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada stok ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                stocks.map((stock: any) => {
                  const isLowStock = (stock.quantityAvailable || 0) < (stock.minStock || 0);
                  return (
                    <tr
                      key={stock.id}
                      className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {stock.product?.name || '-'}
                        </div>
                        <div className="text-xs text-gray-500">{stock.product?.sku || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{stock.branch?.name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-base font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}
                          >
                            {stock.quantityAvailable || 0}
                          </span>
                          {isLowStock && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Rendah
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{stock.minStock || 0}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency((stock.product?.costPrice || 0) * (stock.quantityAvailable || 0))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && stocks.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Menampilkan <span className="font-bold text-gray-900">{stocks.length}</span> dari{' '}
                <span className="font-bold text-gray-900">{pagination.total}</span> stok
                <span className="ml-2 text-gray-500">
                  (Halaman {pagination.page} dari {pagination.totalPages})
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-primary-500 hover:text-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-primary-500 hover:text-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
