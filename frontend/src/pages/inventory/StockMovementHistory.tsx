import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Loader2,
  Package,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { inventoryService } from '../../services/inventory.service';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';

export default function StockMovementHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMovementType, setSelectedMovementType] = useState<string>('ALL');
  const [selectedReferenceType, setSelectedReferenceType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'inventory-movements',
      page,
      searchTerm,
      selectedMovementType,
      selectedReferenceType,
      startDate,
      endDate,
      branchId,
    ],
    queryFn: () =>
      inventoryService.getStockMovementHistory({
        page,
        limit,
        branchId: branchId || undefined,
        movementType: selectedMovementType !== 'ALL' ? selectedMovementType : undefined,
        referenceType: selectedReferenceType !== 'ALL' ? selectedReferenceType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });


  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedMovementType, selectedReferenceType, startDate, endDate, refetch]);

  const movements = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN':
        return <ArrowUp className="w-4 h-4 text-green-600" />;
      case 'OUT':
        return <ArrowDown className="w-4 h-4 text-red-600" />;
      case 'TRANSFER':
        return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
      case 'ADJUSTMENT':
        return <Package className="w-4 h-4 text-yellow-600" />;
      default:
        return <Package className="w-4 h-4 text-gray-600" />;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'IN':
        return 'text-green-600 bg-green-50';
      case 'OUT':
        return 'text-red-600 bg-red-50';
      case 'TRANSFER':
        return 'text-blue-600 bg-blue-50';
      case 'ADJUSTMENT':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getReferenceLink = (referenceType: string, referenceId: string | null, notes: string | null) => {
    // For SERVICE, parse service order ID from notes
    if (referenceType === 'SERVICE' && !referenceId && notes) {
      // Notes format: "Parts used for service SRV-20241120-000001 (ID: uuid) - Internal"
      const match = notes.match(/\(ID:\s*([a-f0-9-]+)\)/i);
      if (match && match[1]) {
        return `/service-orders/${match[1]}`;
      }
    }

    if (!referenceId) return null;

    switch (referenceType) {
      case 'SALE':
      case 'SALES_TRANSACTION':
      case 'VOID':
        return `/sales/transactions/${referenceId}`;
      case 'SERVICE_ORDER':
      case 'SERVICE':
        return `/service-orders/${referenceId}`;
      case 'TRANSFER':
        return `/inventory/transfers/${referenceId}`;
      case 'OPNAME':
        return `/inventory/opname/${referenceId}`;
      default:
        return null;
    }
  };

  const getDisplayNotes = (referenceType: string, notes: string | null, referenceId: string | null) => {
    // For SALE, if notes is empty, show default message in English
    if (referenceType === 'SALE' && !notes && referenceId) {
      return `Sale transaction #${referenceId.substring(0, 8)}...`;
    }
    return notes || '-';
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <PageHeader title="Riwayat Perpindahan Stok" subtitle="Lihat semua perpindahan stok produk" />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              placeholder="Cari produk..."
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedMovementType}
              onChange={(e) => setSelectedMovementType(e.target.value)}
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="IN">Masuk (IN)</option>
              <option value="OUT">Keluar (OUT)</option>
              <option value="TRANSFER">Transfer</option>
              <option value="ADJUSTMENT">Penyesuaian</option>
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedReferenceType}
              onChange={(e) => setSelectedReferenceType(e.target.value)}
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white"
            >
              <option value="ALL">Semua Referensi</option>
              <option value="SALE">Penjualan</option>
              <option value="SERVICE">Service</option>
              <option value="TRANSFER">Transfer</option>
              <option value="OPNAME">Opname</option>
              <option value="ADJUSTMENT">Penyesuaian</option>
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
            />
          </div>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Cabang
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Sebelum
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Perubahan
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Sesudah
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Referensi
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat data perpindahan...</p>
                    </div>
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Package className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada perpindahan ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                movements.map((movement: any) => {
                  const referenceLink = getReferenceLink(movement.referenceType, movement.referenceId, movement.notes);
                  const displayNotes = getDisplayNotes(movement.referenceType, movement.notes, movement.referenceId);
                  return (
                    <tr
                      key={movement.id}
                      className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(movement.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(movement.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {movement.product?.name || '-'}
                        </div>
                        <div className="text-xs text-gray-500">SKU: {movement.product?.sku || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{movement.branch?.name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getMovementColor(
                            movement.movementType,
                          )}`}
                        >
                          {getMovementIcon(movement.movementType)}
                          {movement.movementType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {movement.quantityBefore || 0}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div
                          className={`text-sm font-semibold flex items-center justify-end gap-1 ${
                            movement.quantityChange > 0
                              ? 'text-green-600'
                              : movement.quantityChange < 0
                                ? 'text-red-600'
                                : 'text-gray-900'
                          }`}
                        >
                          {movement.quantityChange > 0 ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : movement.quantityChange < 0 ? (
                            <TrendingDown className="w-4 h-4" />
                          ) : null}
                          {movement.quantityChange > 0 ? '+' : ''}
                          {movement.quantityChange}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {movement.quantityAfter || 0}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {referenceLink ? (
                          <Link
                            to={referenceLink}
                            className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            {movement.referenceType}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">{movement.referenceType || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={displayNotes}>
                          {displayNotes}
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
        {!isLoading && movements.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Menampilkan <span className="font-bold text-gray-900">{movements.length}</span> dari{' '}
                <span className="font-bold text-gray-900">{pagination.total}</span> perpindahan
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

