import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import {
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  Truck,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Clock,
  Package,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import type { StockTransfer } from '../../services/inventory.service';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';

export default function StockTransferList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const { branchId, setBranchId } = useBranchFilter();

  const { data: transfers, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory-transfers', page, searchTerm, selectedStatus, branchId],
    queryFn: () =>
      inventoryService.getTransfers({
        branchId: branchId || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, refetch]);

  const filteredTransfers = (transfers || []).filter((transfer: StockTransfer) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      transfer.transferNumber.toLowerCase().includes(search) ||
      transfer.fromBranch?.name.toLowerCase().includes(search) ||
      transfer.toBranch?.name.toLowerCase().includes(search)
    );
  });

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'sent':
        return <Truck className="w-4 h-4" />;
      case 'received':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Menunggu';
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotalValue = (transfer: StockTransfer) => {
    return transfer.items.reduce((sum, item) => {
      const costPrice = item.product?.costPrice
        ? typeof item.product.costPrice === 'string'
          ? parseFloat(item.product.costPrice)
          : Number(item.product.costPrice)
        : 0;
      return sum + costPrice * item.quantityRequested;
    }, 0);
  };

  const statusCounts = {
    pending: filteredTransfers.filter((t: StockTransfer) => t.status === 'pending').length,
    approved: filteredTransfers.filter((t: StockTransfer) => t.status === 'approved').length,
    sent: filteredTransfers.filter((t: StockTransfer) => t.status === 'sent').length,
    received: filteredTransfers.filter((t: StockTransfer) => t.status === 'received').length,
    cancelled: filteredTransfers.filter((t: StockTransfer) => t.status === 'cancelled').length,
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <PageHeader title="Transfer Stok" subtitle="Kelola transfer stok antar cabang">
        <Link
          to="/inventory/transfer/new"
          className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-all flex items-center gap-2 backdrop-blur-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Transfer Baru</span>
        </Link>
      </PageHeader>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Menunggu</span>
            <Clock className="w-4 h-4 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.pending}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Disetujui</span>
            <CheckCircle className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.approved}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Dikirim</span>
            <Truck className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.sent}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Diterima</span>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.received}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Dibatalkan</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.cancelled}</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <BranchFilterSelect value={branchId} onChange={setBranchId} />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor transfer, cabang..."
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white"
            >
              <option value="ALL">Semua Status</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="sent">Dikirim</option>
              <option value="received">Diterima</option>
              <option value="cancelled">Dibatalkan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nomor Transfer
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Dari → Ke
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nilai
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat data transfer...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Truck className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada transfer ditemukan</p>
                      <Link
                        to="/inventory/transfer/new"
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Buat Transfer Baru
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((transfer: StockTransfer) => {
                  const totalValue = calculateTotalValue(transfer);
                  return (
                    <tr
                      key={transfer.id}
                      className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100 cursor-pointer"
                      onClick={() => navigate(`/inventory/transfer/${transfer.id}`)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{transfer.transferNumber}</div>
                        <div className="text-xs text-gray-500">
                          {transfer.transferType === 'urgent' ? (
                            <span className="text-red-600 font-medium">Urgent</span>
                          ) : (
                            'Regular'
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900">
                            {transfer.fromBranch?.name || '-'}
                          </div>
                          <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                          <div className="text-sm font-medium text-gray-900">
                            {transfer.toBranch?.name || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <div className="text-sm text-gray-900">
                            {transfer.items.length} {transfer.items.length === 1 ? 'produk' : 'produk'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            transfer.status,
                          )}`}
                        >
                          {getStatusIcon(transfer.status)}
                          {getStatusLabel(transfer.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(totalValue)}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(transfer.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(transfer.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Link
                          to={`/inventory/transfer/${transfer.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Detail</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

