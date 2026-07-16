import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, AlertTriangle, Warehouse, Filter } from 'lucide-react';
import { api } from '../../services/api';
import { useBranchStore } from '@/stores/branchStore';
import { PageHeader } from '@/components/shared';
import { StatCard } from '@/components/shared';
import { DataTable } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '../../utils/format';

export default function StockList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { availableBranches } = useBranchStore();

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedBranchId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product-stocks', page, searchTerm, selectedBranchId],
    queryFn: async () => {
      const response = await api.get('/inventory/stock', {
        params: {
          page,
          limit,
          search: searchTerm || undefined,
          branchId: selectedBranchId || undefined,
        },
      });
      return response.data;
    },
  });

  const stocks = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const lowStockCount = stocks.filter((s: any) => (s.quantityAvailable || 0) < (s.minStock || 0)).length;
  const totalValue = stocks.reduce(
    (acc: number, s: any) => acc + ((s.product?.costPrice || 0) * (s.quantityAvailable || 0)),
    0,
  );

  const columns: Column<any>[] = [
    {
      key: 'product',
      header: 'Produk',
      cell: (stock) => (
        <div>
          <div className="text-sm font-semibold text-foreground">{stock.product?.name || '-'}</div>
          <div className="text-xs text-muted-foreground">{stock.product?.sku || '-'}</div>
        </div>
      ),
    },
    {
      key: 'branch',
      header: 'Cabang',
      cell: (stock) => <div className="text-sm text-foreground">{stock.branch?.name || '-'}</div>,
    },
    {
      key: 'available',
      header: 'Stok Tersedia',
      cell: (stock) => {
        const isLow = (stock.quantityAvailable || 0) < (stock.minStock || 0);
        return (
          <div className="flex items-center gap-2">
            <span className={`text-base font-bold ${isLow ? 'text-red-600' : 'text-foreground'}`}>
              {stock.quantityAvailable || 0}
            </span>
            {isLow && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Rendah
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'minStock',
      header: 'Min Stock',
      cell: (stock) => <div className="text-sm text-foreground">{stock.minStock || 0}</div>,
    },
    {
      key: 'value',
      header: 'Nilai',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (stock) => (
        <div className="text-sm font-semibold text-foreground">
          {formatCurrency((stock.product?.costPrice || 0) * (stock.quantityAvailable || 0))}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full space-y-3">
      <PageHeader title="Manajemen Stok" subtitle="Kelola stok produk per cabang" />

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          icon={<Warehouse className="w-6 h-6 text-white" />}
          iconBg="from-primary-500 to-primary-600"
          label="Total Produk"
          value={isLoading ? '-' : pagination.total}
          subtitle="Produk dengan stok"
        />
        <StatCard
          icon={<Package className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Nilai Stok"
          value={isLoading ? '-' : formatCurrency(totalValue)}
          subtitle="Total nilai inventori"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-white" />}
          iconBg="from-yellow-500 to-yellow-600"
          label="Stok Rendah"
          value={isLoading ? '-' : lowStockCount}
          subtitle="Perlu restock"
          badge={{ text: 'Alert', className: 'bg-yellow-100 text-yellow-800' }}
        />
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari produk atau SKU..."
              className="w-full pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full pl-10 h-10 rounded-lg border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none"
            >
              <option value="">Semua Cabang</option>
              {availableBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={stocks}
        keyExtractor={(stock: any) => stock.id}
        isLoading={isLoading}
        emptyMessage="Tidak ada stok ditemukan"
        emptyIcon={<Package className="w-16 h-16" />}
      />

      {/* Pagination */}
      {!isLoading && stocks.length > 0 && pagination.totalPages > 1 && (
        <div className="bg-white px-6 py-4 rounded-xl border border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Menampilkan {stocks.length} dari{' '}
            <span className="font-semibold">{pagination.total}</span> stok
            <span className="ml-2 text-gray-500">
              (Halaman {pagination.page} dari {pagination.totalPages})
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
              Sebelumnya
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pagination.totalPages}>
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
