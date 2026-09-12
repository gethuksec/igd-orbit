import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, AlertTriangle, Warehouse, Download, X } from 'lucide-react';
import { api } from '../../services/api';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { BreadcrumbHeader, StatCard, DataTable, FilterToolbar } from '@/components/shared';
import type { Column } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '../../utils/format';

interface Tier {
  id: string;
  code: string;
  name: string;
  discountPercentage: number;
}

const memberPrice = (selling: number, discount: number) =>
  Math.round(selling * (1 - (discount || 0) / 100));

// Mirrors backend StockService.EXPORT_COLUMNS (IGDERP-106)
const EXPORT_COLUMNS: { key: string; label: string }[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'product', label: 'Produk' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'branch', label: 'Cabang' },
  { key: 'warehouse', label: 'Gudang' },
  { key: 'available', label: 'Stok Tersedia' },
  { key: 'minStock', label: 'Min Stock' },
  { key: 'reorderPoint', label: 'Reorder Point' },
  { key: 'regularPrice', label: 'Harga Reguler' },
  { key: 'memberPrice', label: 'Harga Member' },
  { key: 'ageDays', label: 'Umur Stok (hari)' },
  { key: 'stockValue', label: 'Nilai Stok' },
];

// IGDERP-89: per-warehouse breakdown, fetched lazily on first hover
function WarehouseBreakdown({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-stock-breakdown', productId],
    queryFn: async () => {
      const response = await api.get(`/inventory/stock/${productId}`);
      return response.data;
    },
    staleTime: 60_000,
  });
  if (isLoading) return <div className="text-xs text-muted-foreground">Memuat...</div>;
  const stocks = data?.stocks || [];
  if (!stocks.length) return <div className="text-xs text-muted-foreground">Tidak ada data gudang</div>;
  return (
    <div className="space-y-1 min-w-[220px]">
      <div className="text-xs font-semibold mb-1">Stok per gudang</div>
      {stocks.map((s: any) => (
        <div key={s.id} className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted-foreground">
            {s.warehouse?.name || '-'}
            <span className="ml-1 opacity-70">({s.branch?.name || '-'})</span>
          </span>
          <span className="font-bold">{s.quantityAvailable ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

function StockQtyCell({ stock }: { stock: any }) {
  const [open, setOpen] = useState(false);
  const isLow = (stock.quantityAvailable || 0) < (stock.minStock || 0);
  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-2 cursor-help w-fit"
            onMouseEnter={() => setOpen(true)}
          >
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
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          {open && stock.productId ? (
            <WarehouseBreakdown productId={stock.productId} />
          ) : (
            <div className="text-xs text-muted-foreground">Tidak ada data gudang</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function StockList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  // IGDERP-88 threshold toggle — hide zero-stock rows
  const [hideZero, setHideZero] = useState(false);
  // IGDERP-104 drill-down target (BE stockStatus: low | out | available)
  const [stockStatus, setStockStatus] = useState<string | undefined>(undefined);
  // IGDERP-106 export column popup
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCols, setExportCols] = useState<string[]>(EXPORT_COLUMNS.map((c) => c.key));
  const [exporting, setExporting] = useState(false);
  const limit = 20;
  const { branchId, setBranchId } = useBranchFilter();

  useEffect(() => {
    setPage(1);
  }, [searchTerm, branchId, hideZero, stockStatus]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product-stocks', page, searchTerm, branchId, hideZero, stockStatus],
    queryFn: async () => {
      const response = await api.get('/inventory/stock', {
        params: {
          page,
          limit,
          search: searchTerm || undefined,
          branchId: branchId || undefined,
          hideZero: hideZero || undefined,
          stockStatus: stockStatus || undefined,
        },
      });
      return response.data;
    },
  });

  const stocks = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };
  const tiers: Tier[] = (data?.meta?.tiers || []).filter((t: Tier) => Number(t.discountPercentage) > 0);

  const lowStockCount = stocks.filter((s: any) => (s.quantityAvailable || 0) < (s.minStock || 0)).length;
  const totalValue = stocks.reduce(
    (acc: number, s: any) => acc + ((s.product?.costPrice || 0) * (s.quantityAvailable || 0)),
    0,
  );

  const toggleExportCol = (key: string) =>
    setExportCols((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const handleExport = async () => {
    if (!exportCols.length) return;
    setExporting(true);
    try {
      const response = await api.get('/inventory/stock/export', {
        params: {
          search: searchTerm || undefined,
          branchId: branchId || undefined,
          hideZero: hideZero || undefined,
          stockStatus: stockStatus || undefined,
          columns: exportCols.join(','),
        },
        responseType: 'blob',
      });
      const csvText = await response.data.text();
      const url = window.URL.createObjectURL(new Blob([csvText], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `stok-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  };

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
      cell: (stock) => <StockQtyCell stock={stock} />,
    },
    {
      // IGDERP-91: days since this (product, branch) pair first held stock > 0
      key: 'age',
      header: 'Umur',
      cell: (stock) => (
        <div className="text-sm text-foreground">
          {stock.ageDays === null || stock.ageDays === undefined ? '-' : `${stock.ageDays} hari`}
        </div>
      ),
    },
    {
      key: 'minStock',
      header: 'Min Stock',
      cell: (stock) => <div className="text-sm text-foreground">{stock.minStock || 0}</div>,
    },
    {
      // IGDERP-88: reguler (black) + member per tier (red), same values as master product
      key: 'sellPrice',
      header: 'Harga Jual',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (stock) => {
        const regular = Number(stock.product?.sellingPrice || 0);
        return (
          <div>
            <div className="text-sm font-semibold text-foreground">{formatCurrency(regular)}</div>
            {tiers.map((t) => (
              <div key={t.id} className="text-xs font-medium text-red-600">
                {t.name}: {formatCurrency(memberPrice(regular, Number(t.discountPercentage)))}
              </div>
            ))}
          </div>
        );
      },
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
      <BreadcrumbHeader title="Manajemen Stok" subtitle="Kelola stok produk per cabang" />

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* IGDERP-104: summary click drills down (filter auto-applied, same page) */}
        <div
          className="cursor-pointer"
          title="Tampilkan semua (reset filter)"
          onClick={() => setStockStatus(undefined)}
        >
          <StatCard
            icon={<Warehouse className="w-6 h-6 text-white" />}
            iconBg="from-primary-500 to-primary-600"
            label="Total Produk"
            value={isLoading ? '-' : pagination.total}
            subtitle="Produk dengan stok — klik untuk reset"
          />
        </div>
        <StatCard
          icon={<Package className="w-6 h-6 text-white" />}
          iconBg="from-green-500 to-green-600"
          label="Nilai Stok"
          value={isLoading ? '-' : formatCurrency(totalValue)}
          subtitle="Total nilai inventori"
        />
        <div
          className={`cursor-pointer rounded-xl ${stockStatus === 'low' ? 'ring-2 ring-yellow-500' : ''}`}
          title="Filter: hanya stok rendah"
          onClick={() => setStockStatus((s) => (s === 'low' ? undefined : 'low'))}
        >
          <StatCard
            icon={<AlertTriangle className="w-6 h-6 text-white" />}
            iconBg="from-yellow-500 to-yellow-600"
            label="Stok Rendah"
            value={isLoading ? '-' : lowStockCount}
            subtitle="Perlu restock — klik untuk filter"
            badge={{ text: 'Alert', className: 'bg-yellow-100 text-yellow-800' }}
          />
        </div>
      </div>

      {stockStatus && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
            Filter: {stockStatus === 'low' ? 'Stok rendah' : stockStatus}
            <button
              aria-label="Reset filter status"
              className="ml-1 hover:text-yellow-900"
              onClick={() => setStockStatus(undefined)}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari produk atau SKU..."
        branchFilter={{ value: branchId, onChange: setBranchId, allowAll: true }}
        fields={[]}
        values={{}}
        onFieldChange={() => {}}
        onReset={() => {}}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <Switch checked={hideZero} onCheckedChange={setHideZero} />
          Sembunyikan stok kosong
        </label>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
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

      {/* IGDERP-106: export column picker — active list filters are applied */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Stok (CSV)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Filter aktif (cabang, pencarian, status, threshold) ikut diterapkan.
          </p>
          <div className="grid grid-cols-2 gap-2 py-2">
            {EXPORT_COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={exportCols.includes(c.key)}
                  onCheckedChange={() => toggleExportCol(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setExportCols(
                  exportCols.length === EXPORT_COLUMNS.length ? [] : EXPORT_COLUMNS.map((c) => c.key),
                )
              }
            >
              {exportCols.length === EXPORT_COLUMNS.length ? 'Hapus semua' : 'Pilih semua'}
            </Button>
            <Button size="sm" onClick={handleExport} disabled={!exportCols.length || exporting}>
              {exporting ? 'Mengekspor...' : `Export (${exportCols.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
