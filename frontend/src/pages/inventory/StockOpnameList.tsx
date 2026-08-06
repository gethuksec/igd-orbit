import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  ClipboardCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { inventoryService } from '../../services/inventory.service';
import type { StockOpname } from '../../services/inventory.service';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';

export default function StockOpnameList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const { branchId, setBranchId } = useBranchFilter();

  const { data: opnames, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory-opnames', searchTerm, selectedStatus, branchId],
    queryFn: () =>
      inventoryService.getOpnames({
        branchId: branchId || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, refetch]);

  const filteredOpnames = (opnames || []).filter((opname: StockOpname) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      opname.opnameNumber.toLowerCase().includes(search) ||
      opname.branch?.name.toLowerCase().includes(search)
    );
  });

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
        return 'Selesai';
      case 'approved':
        return 'Disetujui';
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

  const statusCounts = {
    draft: filteredOpnames.filter((o: StockOpname) => o.status === 'draft').length,
    counting: filteredOpnames.filter((o: StockOpname) => o.status === 'counting').length,
    completed: filteredOpnames.filter((o: StockOpname) => o.status === 'completed').length,
    approved: filteredOpnames.filter((o: StockOpname) => o.status === 'approved').length,
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Stock Opname" subtitle="Kelola stock opname dan audit stok">
        <Link
          to="/inventory/opname/new"
          className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-all flex items-center gap-2 backdrop-blur-sm"
        >
          <Plus className="w-5 h-5" />
          <span>Mulai Opname</span>
        </Link>
      </BreadcrumbHeader>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Draft</span>
            <Clock className="w-4 h-4 text-gray-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.draft}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Sedang Dihitung</span>
            <ClipboardCheck className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.counting}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Selesai</span>
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.completed}</h3>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Disetujui</span>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{statusCounts.approved}</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              placeholder="Cari nomor opname, cabang..."
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
              <option value="draft">Draft</option>
              <option value="counting">Sedang Dihitung</option>
              <option value="completed">Selesai</option>
              <option value="approved">Disetujui</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opnames Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nomor Opname
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Cabang
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Total Item
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nilai Discrepancy
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
                      <p className="text-gray-600 font-semibold text-lg">Memuat data opname...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOpnames.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <ClipboardCheck className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada opname ditemukan</p>
                      <Link
                        to="/inventory/opname/new"
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Mulai Opname Baru
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOpnames.map((opname: StockOpname) => {
                  const totalDiscrepancyValue = opname.totalDiscrepancyValue
                    ? typeof opname.totalDiscrepancyValue === 'string'
                      ? parseFloat(opname.totalDiscrepancyValue)
                      : Number(opname.totalDiscrepancyValue)
                    : 0;
                  const countedItems = opname.items.filter((item) => item.physicalQuantity !== null).length;
                  const totalItems = opname.items.length;

                  return (
                    <tr
                      key={opname.id}
                      className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100 cursor-pointer"
                      onClick={() => navigate(`/inventory/opname/${opname.id}`)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{opname.opnameNumber}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{opname.branch?.name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(opname.opnameDate).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            opname.status,
                          )}`}
                        >
                          {getStatusLabel(opname.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {countedItems} / {totalItems}
                        </div>
                        {opname.status === 'counting' && (
                          <div className="text-xs text-gray-500">
                            {Math.round((countedItems / totalItems) * 100)}% selesai
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div
                          className={`text-sm font-semibold ${
                            totalDiscrepancyValue > 0
                              ? 'text-green-600'
                              : totalDiscrepancyValue < 0
                                ? 'text-red-600'
                                : 'text-gray-900'
                          }`}
                        >
                          {formatCurrency(Math.abs(totalDiscrepancyValue))}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Link
                          to={`/inventory/opname/${opname.id}`}
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

