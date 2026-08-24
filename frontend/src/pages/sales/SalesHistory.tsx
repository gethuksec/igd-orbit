import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, Receipt, DollarSign, ShoppingCart } from 'lucide-react';
import { salesService } from '../../services/sales.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { BreadcrumbHeader, FilterToolbar, StatCard, DataTable, RowsPerPageSelect } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '../../utils/format';

export default function SalesHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sales-transactions', page, limit, searchTerm, selectedStatus, branchId],
    queryFn: () =>
      salesService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        branchId: branchId || undefined,
        status: selectedStatus || undefined,
      }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const transactions = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const totalRevenue = transactions.reduce((acc, t) => acc + (t.total || t.totalPrice || 0), 0);
  const totalTransactions = pagination.total;

  const columns: Column<any>[] = [
    {
      key: 'transactionNumber',
      header: 'No. Transaksi',
      cell: (tx) => (
        <Link
          to={`/sales/transactions/${tx.id}`}
          className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
        >
          {tx.transactionNumber}
        </Link>
      ),
    },
    {
      key: 'createdAt',
      header: 'Tanggal',
      cell: (tx) => (
        <div className="text-sm text-foreground">
          {new Date(tx.createdAt).toLocaleDateString('id-ID')}
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Pelanggan',
      cell: (tx) =>
        tx.customer?.id ? (
          <Link
            to={`/customers/${tx.customer.id}`}
            className="text-sm text-primary-600 hover:text-primary-700 hover:underline transition-colors font-medium"
          >
            {tx.customer.name || '-'}
          </Link>
        ) : (
          <div className="text-sm text-foreground">-</div>
        ),
    },
    {
      key: 'items',
      header: 'Items',
      cell: (tx) => (
        <div className="text-sm text-foreground">{tx.itemCount || tx.items?.length || 0} item</div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (tx) => (
        <div className="text-sm font-bold text-primary-600">
          {formatCurrency(tx.total || tx.totalPrice || 0)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      headerClassName: 'text-center',
      className: 'text-center',
      cell: (tx) => {
        let label = tx.status || '-';
        let colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
        if (tx.status === 'void' || tx.status === 'cancelled') {
          label = 'Dibatalkan';
          colorClass = 'bg-red-100 text-red-800 border-red-200';
        } else if (tx.status === 'completed') {
          label = 'Selesai';
          colorClass = 'bg-green-100 text-green-800 border-green-200';
        }
        return (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}
          >
            {label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="w-full space-y-3">
      <BreadcrumbHeader title="Riwayat Penjualan" subtitle="Daftar semua transaksi penjualan" />

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatCard
          icon={<DollarSign className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Total Pendapatan"
          value={isLoading ? '-' : formatCurrency(totalRevenue)}
          subtitle="Dari semua transaksi"
        />
        <StatCard
          icon={<ShoppingCart className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Transaksi"
          value={isLoading ? '-' : totalTransactions}
          subtitle="Semua transaksi terdaftar"
        />
      </div>

      {/* Toolbar: search inline + branch inline + filter popup (IGDERP-110) */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Cari nomor transaksi, pelanggan, atau produk..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'completed', label: 'Selesai' },
              { value: 'held', label: 'Ditahan' },
              { value: 'void', label: 'Dibatalkan' },
              { value: 'cancelled', label: 'Batal' },
              { value: 'returned', label: 'Retur' },
            ],
          },
        ]}
        values={{ status: selectedStatus }}
        onFieldChange={(key, value) => {
          if (key === 'status') {
            setSelectedStatus(value);
            setPage(1);
          }
        }}
        onReset={() => {
          setSelectedStatus('');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={transactions}
        keyExtractor={(tx: any) => tx.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada transaksi ditemukan"
        emptyIcon={<Receipt className="w-16 h-16" />}
        actions={(tx: any) => (
          <Link to={`/sales/transactions/${tx.id}`}>
            <Button variant="ghost" size="sm" title="Lihat Detail">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
        )}
      />

      {/* Pagination */}
      {!isLoading && transactions.length > 0 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
          <RowsPerPageSelect
            value={limit}
            onChange={(v) => {
              setLimit(v);
              setPage(1);
            }}
          />
          <div className="text-sm text-gray-700">
            Menampilkan {transactions.length} dari{' '}
            <span className="font-semibold">{pagination.total}</span> transaksi
            <span className="ml-2 text-gray-500">
              (Halaman {pagination.page} dari {pagination.totalPages})
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
