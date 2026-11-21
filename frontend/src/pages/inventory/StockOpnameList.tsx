import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Eye,
  Loader2,
  ClipboardCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { BreadcrumbHeader, FilterToolbar, StatCard, StatusDot } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventory.service';
import type { StockOpname } from '../../services/inventory.service';
import StockOpnameStartModal from './StockOpnameStartModal';
import { useBranchFilter } from '@/components/branch/BranchFilter';

export default function StockOpnameList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const { branchId, setBranchId } = useBranchFilter();
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: (id: string) => inventoryService.cancelOpname(id),
    onSuccess: () => {
      toast.success('Opname dibatalkan — outlet bebas untuk opname baru');
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membatalkan opname');
      queryClient.invalidateQueries({ queryKey: ['inventory-opnames'] });
    },
  });

  const { data: opnames, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory-opnames', searchTerm, selectedStatus, branchId, dateFrom, dateTo],
    queryFn: () =>
      inventoryService.getOpnames({
        branchId: branchId || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, dateFrom, dateTo, refetch]);

  const filteredOpnames = (opnames || []).filter((opname: StockOpname) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      opname.opnameNumber.toLowerCase().includes(search) ||
      opname.branch?.name.toLowerCase().includes(search)
    );
  });

  const getStatusTone = (status: string): 'ok' | 'warn' | 'off' | 'bad' => {
    switch (status) {
      case 'draft':
        return 'off';
      case 'counting':
        return 'warn';
      case 'completed':
      case 'approved':
        return 'ok';
      case 'cancelled':
        return 'bad';
      default:
        return 'off';
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
        <Button onClick={() => setStartOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Mulai Opname
        </Button>
      </BreadcrumbHeader>
      <StockOpnameStartModal open={startOpen} onClose={() => setStartOpen(false)} />

      {/* IGDERP-234 (OP2): join a counting session via its short code */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const code = joinCode.trim();
          if (!code) return;
          setJoining(true);
          setJoinError(null);
          try {
            const session = await inventoryService.getOpnameByCode(code);
            navigate(`/inventory/opname/${session.id}/count`);
          } catch {
            setJoinError(`Kode "${code}" tidak ditemukan. Periksa kembali kode sesi dari koordinator.`);
          } finally {
            setJoining(false);
          }
        }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-3 flex flex-wrap items-center gap-2"
      >
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 px-1">Gabung sesi hitung</span>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Kode sesi, mis. OPN-7K2QD"
          className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        />
        <Button type="submit" disabled={joining || !joinCode.trim()}>
          {joining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
          Gabung
        </Button>
        {joinError && <span className="text-xs font-medium text-red-600 dark:text-red-400">{joinError}</span>}
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard icon={<Clock className="h-5 w-5" />} label="Draft" value={statusCounts.draft} />
        <StatCard icon={<ClipboardCheck className="h-5 w-5" />} label="Sedang Dihitung" value={statusCounts.counting} />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Selesai" value={statusCounts.completed} />
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Disetujui" value={statusCounts.approved} />
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
          {
            key: 'opnameDate',
            label: 'Tanggal Opname',
            type: 'date-range',
          },
        ]}
        values={{
          status: selectedStatus === 'ALL' ? '' : selectedStatus,
          opnameDateFrom: dateFrom,
          opnameDateTo: dateTo,
        }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setSelectedStatus(v || 'ALL');
          } else if (key === 'opnameDateFrom') {
            setDateFrom(v || '');
          } else if (key === 'opnameDateTo') {
            setDateTo(v || '');
          }
        }}
        onReset={() => {
          setSelectedStatus('ALL');
          setDateFrom('');
          setDateTo('');
        }}
      />

      {/* Opnames Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Nomor opname
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Cabang
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                  Total item
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                  Nilai discrepancy
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300">
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
                      <button
                        onClick={() => setStartOpen(true)}
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Mulai Opname Baru
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOpnames.map((opname: StockOpname) => {
                  const totalDiscrepancyValue = opname.totalDiscrepancyValue
                    ? typeof opname.totalDiscrepancyValue === 'string'
                      ? parseFloat(opname.totalDiscrepancyValue)
                      : Number(opname.totalDiscrepancyValue)
                    : null;
                  const countedItems = opname.items.filter((item) => item.physicalQuantity !== null).length;
                  const totalItems = opname.items.length;

                  return (
                    <tr
                      key={opname.id}
                      className="hover:bg-muted transition-colors border-b border-gray-100 dark:border-gray-800 cursor-pointer"
                      onClick={() => navigate(`/inventory/opname/${opname.id}`)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-[15px] font-medium text-gray-900 dark:text-gray-100">{opname.opnameNumber}</div>
                        {opname.code && (
                          <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">Kode: {opname.code}</div>
                        )}
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
                        <StatusDot tone={getStatusTone(opname.status)}>{getStatusLabel(opname.status)}</StatusDot>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">
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
                        {totalDiscrepancyValue === null ? (
                          <span className="text-sm font-medium text-gray-300 dark:text-gray-600">—</span>
                        ) : (
                          <div
                            className={`text-sm font-medium tabular-nums ${
                              totalDiscrepancyValue > 0
                                ? 'text-green-600 dark:text-green-400'
                                : totalDiscrepancyValue < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {formatCurrency(Math.abs(totalDiscrepancyValue))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-2">
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
                        {(opname.status === 'draft' ||
                          opname.status === 'counting' ||
                          opname.status === 'completed') && (
                          <button
                            title="Batalkan opname"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `Yakin ingin membatalkan opname ${opname.opnameNumber}? Hasil perhitungan yang sudah masuk tetap tersimpan sebagai riwayat, tapi sesi ini berakhir dan stok tidak berubah.`,
                                )
                              ) {
                                cancelMutation.mutate(opname.id);
                              }
                            }}
                            disabled={cancelMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Batal</span>
                          </button>
                        )}
                        </div>
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

