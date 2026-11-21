import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Package,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';
import { inventoryService } from '../../services/inventory.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';

export default function StockMovementHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  // IGDERP-90: global mode (product optional) vs detail mode (barcode/name required)
  const [mode, setMode] = useState<'global' | 'detail'>('global');
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
      mode,
      selectedMovementType,
      selectedReferenceType,
      startDate,
      endDate,
      branchId,
    ],
    // Detail mode requires a product query; global mode lists everything
    enabled: mode === 'global' || searchTerm.trim().length > 0,
    queryFn: () =>
      inventoryService.getStockMovementHistory({
        page,
        limit,
        branchId: branchId || undefined,
        movementType: selectedMovementType !== 'ALL' ? selectedMovementType : undefined,
        referenceType: selectedReferenceType !== 'ALL' ? selectedReferenceType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm.trim() || undefined,
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
        return <ArrowUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'OUT':
        return <ArrowDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'TRANSFER':
        return <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'ADJUSTMENT':
        return <Package className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
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
        return `/inventory/transfer/${referenceId}`;
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
      <BreadcrumbHeader title="Riwayat Perpindahan Stok" subtitle="Lihat semua perpindahan stok produk" />

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* IGDERP-90 mode toggle: global (no product required) vs detail (barcode + name required) */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-0.5 text-sm">
          {(['global', 'detail'] as const).map((m) => (
            <button
              key={m}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                mode === m ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-foreground'
              }`}
              onClick={() => {
                setMode(m);
                setPage(1);
              }}
            >
              {m === 'global' ? 'Global' : 'Detail'}
            </button>
          ))}
        </div>
        {mode === 'detail' && !searchTerm.trim() && (
          <span className="text-xs text-muted-foreground">
            Wajib isi barcode / nama produk untuk mode detail.
          </span>
        )}
      </div>

      {/* Toolbar: search inline + branch inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          mode === 'detail' ? 'Wajib: barcode / nama produk...' : 'Cari produk / SKU / barcode... (opsional)'
        }
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'movementType',
            label: 'Tipe',
            type: 'select',
            options: [
              { value: 'IN', label: 'Masuk (IN)' },
              { value: 'OUT', label: 'Keluar (OUT)' },
              { value: 'TRANSFER', label: 'Transfer' },
              { value: 'ADJUSTMENT', label: 'Penyesuaian' },
            ],
          },
          {
            key: 'referenceType',
            label: 'Referensi',
            type: 'select',
            options: [
              { value: 'SALE', label: 'Penjualan' },
              { value: 'SERVICE', label: 'Service' },
              { value: 'TRANSFER', label: 'Transfer' },
              { value: 'OPNAME', label: 'Opname' },
              { value: 'ADJUSTMENT', label: 'Penyesuaian' },
            ],
          },
          {
            key: 'date',
            label: 'Tanggal',
            type: 'date-range',
          },
        ]}
        values={{
          movementType: selectedMovementType === 'ALL' ? '' : selectedMovementType,
          referenceType: selectedReferenceType === 'ALL' ? '' : selectedReferenceType,
          dateFrom: startDate,
          dateTo: endDate,
        }}
        onFieldChange={(key, v) => {
          if (key === 'movementType') {
            setSelectedMovementType(v || 'ALL');
            setPage(1);
          } else if (key === 'referenceType') {
            setSelectedReferenceType(v || 'ALL');
            setPage(1);
          } else if (key === 'dateFrom') {
            setStartDate(v);
            setPage(1);
          } else if (key === 'dateTo') {
            setEndDate(v);
            setPage(1);
          }
        }}
        onReset={() => {
          setSelectedMovementType('ALL');
          setSelectedReferenceType('ALL');
          setStartDate('');
          setEndDate('');
          setPage(1);
        }}
      />

      {/* Movements Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Produk
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Cabang
                </th>
                {/* IGDERP-194: warehouse column */}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Gudang
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Tipe
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                  Sebelum
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                  Perubahan
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                  Sesudah
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Referensi
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 dark:text-primary-400 animate-spin" />
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Memuat data perpindahan...</p>
                    </div>
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                        <Package className="w-16 h-16 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Tidak ada perpindahan ditemukan</p>
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
                      className="hover:bg-muted transition-colors border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {new Date(movement.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(movement.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {movement.product?.name || '-'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {movement.product?.sku || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{movement.branch?.name || '-'}</div>
                      </td>
                      {/* IGDERP-194 */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{movement.warehouse?.name || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          {getMovementIcon(movement.movementType)}
                          {movement.movementType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                          {movement.quantityBefore || 0}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div
                          className={`text-sm font-medium tabular-nums flex items-center justify-end gap-1 ${
                            movement.quantityChange > 0
                              ? 'text-green-600 dark:text-green-400'
                              : movement.quantityChange < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-900 dark:text-gray-100'
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
                        <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
                          {movement.quantityAfter || 0}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {referenceLink ? (
                          <Link
                            to={referenceLink}
                            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
                          >
                            {movement.referenceType}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">{movement.referenceType || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate" title={displayNotes}>
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
          <div className="border bg-muted px-4 py-3 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{movements.length}</span> dari{' '}
                <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{pagination.total}</span> perpindahan
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  (Halaman {pagination.page} dari {pagination.totalPages})
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
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

