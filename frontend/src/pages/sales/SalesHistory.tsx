import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Eye,
  Receipt,
  Loader2,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { usePermissions } from '@/hooks/usePermissions';
import { BreadcrumbHeader } from '@/components/shared';
import ReturDialog from './ReturDialog';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Selesai', cls: 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' },
  retur: { label: 'Retur', cls: 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800' },
  cancelled: { label: 'Batal', cls: 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800' },
  void: { label: 'Void', cls: 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800' },
  held: { label: 'Held', cls: 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800' },
  pending: { label: 'Pending', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
};

export default function SalesHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const limit = 20;
  const { hasPermission } = usePermissions();

  const canCreateReturn = hasPermission('sales.retur.create');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sales-transactions', page, searchTerm],
    queryFn: () =>
      salesService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const transactions = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);

  const badge = (status: string) => {
    const s = STATUS_BADGE[status?.toLowerCase()] || STATUS_BADGE.pending;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
        {s.label}
      </span>
    );
  };

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader
        title="Riwayat Penjualan"
        subtitle="Daftar semua transaksi penjualan"
      >
        <Link
          to="/sales/returns"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          Retur Penjualan <ArrowRight className="w-4 h-4" />
        </Link>
      </BreadcrumbHeader>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 dark:text-red-200 font-medium">
            {(error as Error).message || 'Terjadi kesalahan'}
          </p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nomor transaksi, pelanggan, atau produk..."
            className="block w-full pl-12 pr-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">No. Transaksi</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tanggal</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Pelanggan</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-spin" />
                      <p className="text-gray-600 dark:text-gray-400 font-semibold">Memuat data transaksi...</p>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                        <Receipt className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 font-semibold">Tidak ada transaksi ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction: any) => {
                  const isSelesai =
                    transaction.status?.toLowerCase() === 'completed';
                  return (
                    <tr
                      key={transaction.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/sales/transactions/${transaction.id}`}
                          className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          {transaction.transactionNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {transaction.createdAt
                          ? new Date(transaction.createdAt).toLocaleDateString('id-ID')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {transaction.customer?.name || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {transaction.itemCount || transaction.items?.length || 0} item
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-primary-600 dark:text-primary-400">
                        {formatCurrency(transaction.total ?? transaction.totalPrice ?? 0)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{badge(transaction.status)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <Link
                          to={`/sales/transactions/${transaction.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {isSelesai && canCreateReturn && (
                          <button
                            onClick={() => setSelectedTransaction(transaction)}
                            className="inline-flex items-center gap-1.5 ml-2 px-2.5 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700"
                            title="Buat Retur"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Retur
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && transactions.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-950 px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Menampilkan <span className="font-bold text-gray-900 dark:text-gray-100">{transactions.length}</span> dari{' '}
              <span className="font-bold text-gray-900 dark:text-gray-100">{pagination.total}</span> transaksi
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                (Halaman {pagination.page} dari {pagination.totalPages})
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      <ReturDialog
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        transaction={selectedTransaction}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
