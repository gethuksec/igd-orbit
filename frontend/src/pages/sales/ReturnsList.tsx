import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Eye,
  RefreshCw,
  DollarSign,
  Package,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import type { SalesTransaction } from '../../services/sales.service';
import { api } from '../../services/api';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';
import { PageHeader } from '@/components/shared';
import { StatCard } from '@/components/shared';
import { DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '../../utils/format';

interface ReturnTransaction extends SalesTransaction {
  returnNumber?: string;
  returnDate?: string;
  returnReason?: string;
  returnStatus?: 'pending' | 'approved' | 'rejected' | 'refunded';
  refundAmount?: number;
  refundMethod?: string;
}

export default function ReturnsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sales-returns', page, searchTerm, selectedStatus, branchId],
    queryFn: async () => {
      try {
        const response = await api.get('/sales/transactions', {
          params: {
            page,
            limit,
            search: searchTerm || undefined,
            branchId: branchId || undefined,
            includeItems: 'true',
          },
        });
        let transactions = response.data.data || [];
        switch (selectedStatus) {
          case 'all':
            transactions = transactions.filter(
              (t: SalesTransaction) => t.status === 'void' || t.status === 'cancelled' || t.paymentStatus === 'refunded',
            );
            break;
          case 'void':
            transactions = transactions.filter((t: SalesTransaction) => t.status === 'void');
            break;
          case 'cancelled':
            transactions = transactions.filter((t: SalesTransaction) => t.status === 'cancelled');
            break;
          case 'refunded':
            transactions = transactions.filter((t: SalesTransaction) => t.paymentStatus === 'refunded');
            break;
          default:
            transactions = transactions.filter(
              (t: SalesTransaction) => t.status === selectedStatus || t.paymentStatus === selectedStatus,
            );
        }
        return {
          data: transactions,
          meta: response.data.meta || { page, limit, total: transactions.length, totalPages: 1 },
        };
      } catch {
        return {
          data: [],
          meta: { page, limit, total: 0, totalPages: 0 },
        };
      }
    },
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus]);

  const returns = (data?.data || []) as ReturnTransaction[];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toUpperCase();
    let classes = 'bg-gray-100 text-gray-800 border-gray-200';
    let icon = <AlertTriangle className="w-3 h-3" />;
    if (s === 'PENDING') { classes = 'bg-yellow-100 text-yellow-800 border-yellow-200'; icon = <Clock className="w-3 h-3" />; }
    else if (s === 'APPROVED') { classes = 'bg-blue-100 text-blue-800 border-blue-200'; icon = <CheckCircle2 className="w-3 h-3" />; }
    else if (s === 'REFUNDED') { classes = 'bg-green-100 text-green-800 border-green-200'; icon = <CheckCircle2 className="w-3 h-3" />; }
    else if (s === 'REJECTED') { classes = 'bg-red-100 text-red-800 border-red-200'; icon = <XCircle className="w-3 h-3" />; }
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${classes}`}>
        {icon}
        {s || 'PENDING'}
      </span>
    );
  };

  const totalReturns = returns.length;
  const totalRefundAmount = returns.reduce((acc, r) => acc + (r.refundAmount || r.total || r.totalPrice || 0), 0);

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
      key: 'date',
      header: 'Tanggal',
      cell: (tx) => (
        <div className="text-sm text-foreground">
          {formatDate(tx.returnDate || tx.createdAt)}
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
            {tx.customer.name || 'Walk-in Customer'}
          </Link>
        ) : (
          <div className="text-sm text-foreground">-</div>
        ),
    },
    {
      key: 'items',
      header: 'Produk',
      cell: (tx) => (
        <div className="flex flex-wrap gap-1">
          {tx.items?.length > 0 ? (
            tx.items.slice(0, 3).map((item: any) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-md border border-primary-200"
              >
                {item.productName || item.product?.name || 'N/A'}
                <span className="text-primary-400">×{item.quantity}</span>
              </span>
            ))
          ) : (
            <span className="text-sm text-foreground">{tx.itemCount || 0} produk</span>
          )}
        </div>
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
      cell: (tx) => getStatusBadge(tx.returnStatus || tx.status),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <PageHeader
        title="Retur Penjualan"
        subtitle="Kelola retur dan refund penjualan"
      >
        <Link to="/sales/returns/new">
          <Button className="flex items-center gap-2 bg-white text-primary-600 hover:bg-primary-50">
            <Plus className="w-5 h-5" />
            <span>Buat Retur</span>
          </Button>
        </Link>
      </PageHeader>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <StatCard
          icon={<RefreshCw className="w-6 h-6 text-white" />}
          iconBg="from-red-500 to-red-600"
          label="Total Retur"
          value={isLoading ? '-' : totalReturns}
          subtitle="Semua transaksi retur"
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6 text-white" />}
          iconBg="from-orange-500 to-orange-600"
          label="Total Refund"
          value={isLoading ? '-' : formatCurrency(totalRefundAmount)}
          subtitle="Total nilai refund"
        />
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex items-end">
            <BranchFilterSelect value={branchId} onChange={setBranchId} />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Cari Nomor Transaksi</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nomor transaksi, customer..."
                className="w-full pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-w-[150px]"
            >
              <option value="all">Semua Status</option>
              <option value="void">Void</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={returns}
        keyExtractor={(tx: any) => tx.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada data retur"
        emptyIcon={<Package className="w-16 h-16" />}
        actions={(tx: any) => (
          <Link to={`/sales/transactions/${tx.id}`}>
            <Button variant="ghost" size="sm" title="Lihat Detail">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
        )}
      />

      {/* Pagination */}
      {!isLoading && returns.length > 0 && pagination.totalPages > 1 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Menampilkan {((pagination.page - 1) * pagination.limit + 1).toLocaleString('id-ID')} -{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString('id-ID')} dari{' '}
            {pagination.total.toLocaleString('id-ID')} retur
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Sebelumnya
            </Button>
            <span className="px-4 py-2 text-sm font-medium text-gray-700">
              Halaman {pagination.page} dari {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
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
