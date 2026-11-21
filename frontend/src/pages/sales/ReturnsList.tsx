import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, Loader2, FileX2 } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { BreadcrumbHeader, StatusDot } from '@/components/shared';

const SETTLEMENT_TONE: Record<string, { label: string; tone: 'ok' | 'warn' | 'off' | 'bad' }> = {
  cash: { label: 'Tunai', tone: 'ok' },
  exchange: { label: 'Tukar Barang', tone: 'warn' },
  deposit: { label: 'Deposit', tone: 'warn' },
};

/**
 * Retur Penjualan — read-only list.
 * Retur dibuat dari Riwayat Penjualan (aksi Retur pada transaksi Selesai).
 * Tidak ada tombol buat di halaman ini.
 */
export default function ReturnsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-returns', page, searchTerm],
    queryFn: () =>
      salesService.getReturns({
        page,
        limit,
        search: searchTerm || undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const returns = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);

  const badge = (type: string) => {
    const s = SETTLEMENT_TONE[type] || SETTLEMENT_TONE.cash;
    return <StatusDot tone={s.tone}>{s.label}</StatusDot>;
  };

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader
        title="Retur Penjualan"
        subtitle="Daftar retur penjualan"
      />

      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-800 dark:text-red-200 flex gap-2">
        <span>ℹ️</span>
        <span>
          <b>Retur dibuat dari Riwayat Penjualan</b> — pilih aksi "Retur" pada transaksi
          berstatus Selesai. Halaman ini hanya menampilkan daftar retur (tanpa tombol buat).
        </span>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">
            {(error as Error).message || 'Terjadi kesalahan'}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nomor retur, nomor faktur, atau pelanggan..."
            className="block w-full pl-12 pr-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-all"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">No. retur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">No. faktur</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pelanggan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Alasan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Penyelesaian</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Akun</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-spin" />
                      <p className="text-gray-600 dark:text-gray-400 font-medium">Memuat data retur...</p>
                    </div>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                        <FileX2 className="h-5 w-5" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">Belum ada retur</p>
                    </div>
                  </td>
                </tr>
              ) : (
                returns.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-primary-600 dark:text-primary-400">
                      {r.returnNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {r.transaction?.transactionNumber || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {r.customer?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-[200px] truncate" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{badge(r.settlementType)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {r.coa ? `${r.coa.code} — ${r.coa.name}` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium tabular-nums text-primary-600 dark:text-primary-400">
                      {formatCurrency(r.refundAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {r.transactionId && (
                        <Link
                          to={`/sales/transactions/${r.transactionId}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                          title="Lihat Detail Transaksi"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && returns.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-950 px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Menampilkan <span className="font-medium text-gray-900 dark:text-gray-100">{returns.length}</span> dari{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">{pagination.total}</span> retur
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                (Halaman {pagination.page} dari {pagination.totalPages})
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
