import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, Loader2, FileX2 } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { BreadcrumbHeader } from '@/components/shared';

const SETTLEMENT_BADGE: Record<string, { label: string; cls: string }> = {
  cash: { label: 'Tunai', cls: 'bg-green-100 text-green-800 border-green-200' },
  exchange: { label: 'Tukar Barang', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  deposit: { label: 'Deposit', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
};

/**
 * Retur Penjualan — read-only list (IGDERP-85).
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
    const s = SETTLEMENT_BADGE[type] || SETTLEMENT_BADGE.cash;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}
      >
        {s.label}
      </span>
    );
  };

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader
        title="Retur Penjualan"
        subtitle="Daftar retur penjualan"
      />

      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 flex gap-2">
        <span>ℹ️</span>
        <span>
          <b>Retur dibuat dari Riwayat Penjualan</b> — pilih aksi "Retur" pada transaksi
          berstatus Selesai. Halaman ini hanya menampilkan daftar retur (tanpa tombol buat).
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error).message || 'Terjadi kesalahan'}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">No. Retur</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">No. Faktur</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Pelanggan</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Alasan</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Penyelesaian</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Akun</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold">Memuat data retur...</p>
                    </div>
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <FileX2 className="w-10 h-10 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold">Belum ada retur</p>
                    </div>
                  </td>
                </tr>
              ) : (
                returns.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-primary-600">
                      {r.returnNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {r.transaction?.transactionNumber || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {r.customer?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{badge(r.settlementType)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {r.coa ? `${r.coa.code} — ${r.coa.name}` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-primary-600">
                      {formatCurrency(r.refundAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {r.transactionId && (
                        <Link
                          to={`/sales/transactions/${r.transactionId}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50"
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
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Menampilkan <span className="font-bold text-gray-900">{returns.length}</span> dari{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> retur
              <span className="ml-2 text-gray-500">
                (Halaman {pagination.page} dari {pagination.totalPages})
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-primary-500 hover:text-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-primary-500 hover:text-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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
