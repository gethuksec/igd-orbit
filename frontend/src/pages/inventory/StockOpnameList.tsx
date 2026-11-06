import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Eye,
  Loader2,
  ClipboardCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { inventoryService } from '../../services/inventory.service';
import type { StockOpname } from '../../services/inventory.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';

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
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
      case 'counting':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'completed':
        return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      case 'approved':
        return 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'cancelled':
        return 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
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
        <Button onClick={() => navigate('/inventory/opname/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Mulai Opname
        </Button>
      </BreadcrumbHeader>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Draft</span>
            <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts.draft}</h3>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sedang Dihitung</span>
            <ClipboardCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts.counting}</h3>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Selesai</span>
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts.completed}</h3>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-4 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Disetujui</span>
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts.approved}</h3>
        </div>
      </div>

      {/* Toolbar: search inline + branch inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nomor opname, cabang..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'counting', label: 'Sedang Dihitung' },
              { value: 'completed', label: 'Selesai' },
              { value: 'approved', label: 'Disetujui' },
              { value: 'cancelled', label: 'Dibatalkan' },
            ],
          },
        ]}
        values={{
          status: selectedStatus === 'ALL' ? '' : selectedStatus,
        }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setSelectedStatus(v || 'ALL');
          }
        }}
        onReset={() => {
          setSelectedStatus('ALL');
        }}
      />

      {/* Opnames Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Nomor Opname
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Cabang
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Total Item
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Nilai Discrepancy
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 dark:text-primary-400 animate-spin" />
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Memuat data opname...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOpnames.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                        <ClipboardCheck className="w-16 h-16 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Tidak ada opname ditemukan</p>
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
                      className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200 border-b border-gray-100 dark:border-gray-800 cursor-pointer"
                      onClick={() => navigate(`/inventory/opname/${opname.id}`)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{opname.opnameNumber}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{opname.branch?.name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
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
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {countedItems} / {totalItems}
                        </div>
                        {opname.status === 'counting' && (
                          <>
                            <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden ml-auto mt-1">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{
                                  width: `${totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0}%`,
                                }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {Math.round((countedItems / totalItems) * 100)}% selesai
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div
                          className={`text-sm font-semibold ${
                            totalDiscrepancyValue > 0
                              ? 'text-green-600 dark:text-green-400'
                              : totalDiscrepancyValue < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {formatCurrency(Math.abs(totalDiscrepancyValue))}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {opname.status === 'counting' ? (
                          <Link
                            to={`/inventory/opname/${opname.id}/count`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                            <span>Lanjutkan</span>
                          </Link>
                        ) : (
                          <Link
                            to={`/inventory/opname/${opname.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Detail</span>
                          </Link>
                        )}
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

