import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Eye,
  RefreshCw,
  DollarSign,
  Package,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import type { SalesTransaction } from '../../services/sales.service';
import { api } from '../../services/api';
import { useBranchStore } from '@/stores/branchStore';

interface ReturnTransaction extends SalesTransaction {
  returnNumber?: string;
  returnDate?: string;
  returnReason?: string;
  returnStatus?: 'pending' | 'approved' | 'rejected' | 'refunded';
  refundAmount?: number;
  refundMethod?: string;
}

export default function ReturnsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { currentBranchId } = useBranchStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sales-returns', page, searchTerm, selectedStatus, currentBranchId],
    queryFn: async () => {
      try {
        // Filter transactions with return status or void status
        const response = await api.get('/sales/transactions', {
          params: {
            page,
            limit,
            search: searchTerm || undefined,
            branchId: currentBranchId || undefined,
            includeItems: 'true', // Include items for display
          },
        });
        // Filter for returns/voids based on selectedStatus
        let transactions = response.data.data || [];
        if (selectedStatus === 'all') {
          transactions = transactions.filter(
            (t: SalesTransaction) => t.status === 'void' || t.status === 'cancelled' || t.paymentStatus === 'refunded',
          );
        } else if (selectedStatus === 'void') {
          transactions = transactions.filter((t: SalesTransaction) => t.status === 'void');
        } else if (selectedStatus === 'cancelled') {
          transactions = transactions.filter((t: SalesTransaction) => t.status === 'cancelled');
        } else if (selectedStatus === 'refunded') {
          transactions = transactions.filter((t: SalesTransaction) => t.paymentStatus === 'refunded');
        } else {
          transactions = transactions.filter(
            (t: SalesTransaction) => t.status === selectedStatus || t.paymentStatus === selectedStatus,
          );
        }
        return {
          data: transactions,
          meta: response.data.meta || { page, limit, total: transactions.length, totalPages: 1 },
        };
      } catch (err: any) {
        return {
          data: [],
          meta: { page, limit, total: 0, totalPages: 0 },
        };
      }
    },
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus]);

  const returns = (data?.data || []) as ReturnTransaction[];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'REFUNDED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'VOID':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'APPROVED':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'REFUNDED':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const totalReturns = returns.length;
  const totalRefundAmount = returns.reduce((acc, r) => acc + (r.refundAmount || r.total || r.totalPrice || 0), 0);

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Retur Penjualan</h1>
            <p className="text-primary-100 text-lg">Kelola retur dan refund penjualan</p>
          </div>
          <Link to="/sales/returns/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              <span>Buat Retur</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl group-hover:scale-110 transition-transform">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Retur</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : totalReturns}</h3>
          <p className="text-xs text-gray-500">Semua transaksi retur</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Refund</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {isLoading ? '-' : formatCurrency(totalRefundAmount)}
          </h3>
          <p className="text-xs text-gray-500">Total nilai refund</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Nomor Transaksi</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nomor transaksi, customer..."
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all bg-white min-w-[150px]"
              >
                <option value="all">Semua Status</option>
                <option value="void">Void</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">Tidak ada data retur</p>
            <p className="text-gray-400 text-sm mt-2">Belum ada transaksi retur yang tercatat</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      No. Transaksi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Pelanggan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Produk yang Dikembalikan
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {returns.map((returnItem) => (
                    <tr
                      key={returnItem.id}
                      className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/sales/transactions/${returnItem.id}`}
                          className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                        >
                          {returnItem.transactionNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {returnItem.returnDate
                            ? formatDate(returnItem.returnDate)
                            : formatDate(returnItem.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {returnItem.customer?.id ? (
                          <Link
                            to={`/customers/${returnItem.customer.id}`}
                            className="text-sm text-primary-600 hover:text-primary-700 hover:underline transition-colors font-medium"
                          >
                            {returnItem.customer.name || 'Walk-in Customer'}
                          </Link>
                        ) : (
                          <div className="text-sm text-gray-900">-</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {returnItem.items && returnItem.items.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {returnItem.items.map((item: any) => (
                              <Link
                                key={item.id}
                                to={`/products/${item.productId || item.product?.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors border border-primary-200"
                                title={`${item.productName || item.product?.name || 'Produk'} (${item.quantity}x)`}
                              >
                                <span>{item.productName || item.product?.name || 'N/A'}</span>
                                <span className="text-primary-400">×{item.quantity}</span>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <Link
                            to={`/sales/transactions/${returnItem.id}`}
                            className="text-sm text-primary-600 hover:text-primary-700 hover:underline transition-colors font-medium"
                          >
                            {returnItem.itemCount || 0} produk
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-bold text-primary-600">
                          {formatCurrency(returnItem.total || returnItem.totalPrice || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${getStatusColor(
                            returnItem.returnStatus || returnItem.status,
                          )}`}
                        >
                          {getStatusIcon(returnItem.returnStatus || returnItem.status)}
                          {(returnItem.returnStatus || returnItem.status || 'PENDING').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <Link to={`/sales/transactions/${returnItem.id}`}>
                          <button
                            className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Menampilkan {((pagination.page - 1) * pagination.limit + 1).toLocaleString('id-ID')} -{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString('id-ID')} dari{' '}
                  {pagination.total.toLocaleString('id-ID')} retur
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  <span className="px-4 py-2 text-sm font-medium text-gray-700">
                    Halaman {pagination.page} dari {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


