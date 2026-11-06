import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  X,
  Loader2,
  PackageMinus,
  Search,
  Trash2,
  ArrowUpFromLine,
  History,
  Upload,
  Download,
} from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../../services/api';
import StockImportModal from './StockImportModal';
import {
  inventoryService,
} from '../../services/inventory.service';
import type {
  StockOutProduct,
  StockOutWarehouse,
} from '../../services/inventory.service';

interface LineItem {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unitId: string;
  unitName: string;
  stockValue: number;
  availableQuantity: number;
}

// Stable empty ref (same nav-freeze lesson as StockTransfer).
const EMPTY_WAREHOUSES: StockOutWarehouse[] = [];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function StockOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [outletId, setOutletId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [documentDate, setDocumentDate] = useState(todayISO());
  const [reason, setReason] = useState('');

  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  // IGDERP-97 (I4): Excel import/export
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!warehouseId) {
      toast.error('Pilih gudang terlebih dahulu');
      return;
    }
    setExporting(true);
    try {
      const blob = await inventoryService.exportStockSnapshot('out', warehouseId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stok-keluar-${warehouseId.slice(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error('Gagal mengunduh export');
    } finally {
      setExporting(false);
    }
  };

  // ── Supporting lists ──
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  // Source warehouses: outlet GOOD warehouses (filtered by outlet when chosen)
  // plus the system-scoped Central Bad Stock warehouse (always available).
  const { data: warehousesData } = useQuery({
    queryKey: ['stock-out-warehouses', outletId],
    queryFn: () => inventoryService.getStockOutWarehouses(outletId || undefined),
  });
  // Stable empty ref (same nav-freeze lesson as StockTransfer: a `= []`
  // default would churn effect deps while the query is pending).
  const warehouses: StockOutWarehouse[] = warehousesData ?? EMPTY_WAREHOUSES;

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const res = await api.get('/units');
      return res.data.data || res.data;
    },
  });

  const { data: productResults = [] } = useQuery({
    queryKey: ['stock-out-products', productSearch, warehouseId],
    queryFn: () =>
      inventoryService.searchStockOutProducts(
        productSearch.trim(),
        15,
        warehouseId || undefined,
      ),
    enabled: productSearch.trim().length >= 2,
  });

  const { data: recentDocs = { data: [], meta: { total: 0 } } } = useQuery({
    queryKey: ['stock-out-docs'],
    queryFn: () => inventoryService.getStockOuts({ page: 1, limit: 10 }),
  });

  const selectedWarehouse = warehouses.find((w: StockOutWarehouse) => w.id === warehouseId);

  // Auto-select the first warehouse when the outlet changes
  // (bail-safe sets only, so a re-run never schedules another render).
  useEffect(() => {
    const first = warehouses.length > 0 ? warehouses[0] : undefined;
    const firstId = first ? first.id : '';
    setWarehouseId((prev) => (prev === firstId ? prev : firstId));
    setItems((prev) => (prev.length === 0 ? prev : []));
    if (first && first.scope === 'SYSTEM') {
      setOutletId((prev) => (prev === '' ? prev : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, warehouses]);

  // When the warehouse changes, clear lines (availability is per-warehouse)
  const handleWarehouseChange = (value: string) => {
    const wh = warehouses.find((w: StockOutWarehouse) => w.id === value);
    if (wh && wh.scope === 'OUTLET' && wh.outletId && !outletId) {
      toast.error('Pilih outlet terlebih dahulu');
      return;
    }
    setWarehouseId(value);
    setItems([]);
    if (wh && wh.scope === 'SYSTEM') {
      setOutletId('');
    }
  };

  const addProductToLines = (product: StockOutProduct, quantity = 1) => {
    const stockValue = product.minSellingPrice ?? product.sellingPrice ?? 0;
    const unitId = product.unitId || '';
    const unitName = product.unit?.name || '';
    setItems((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + quantity } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode || undefined,
          quantity,
          unitId,
          unitName,
          stockValue,
          availableQuantity: product.availableQuantity ?? 0,
        },
      ];
    });
  };

  const handleSelectProduct = (product: StockOutProduct) => {
    if (product.availableQuantity <= 0) {
      toast.error(`Stok "${product.name}" tidak tersedia di gudang ini`);
      return;
    }
    addProductToLines(product);
    setProductSearch('');
  };

  const updateLine = (productId: string, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)),
    );
  };

  const removeLine = (productId: string) => {
    setItems((prev) => prev.filter((l) => l.productId !== productId));
  };

  const totalValue = useMemo(
    () => items.reduce((sum, l) => sum + l.quantity * l.stockValue, 0),
    [items],
  );

  const mutation = useMutation({
    mutationFn: (data: any) => inventoryService.createStockOut(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-out-docs'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast.success('Stok keluar berhasil disimpan');
      setItems([]);
      setReason('');
      setProductSearch('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan saat menyimpan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isCentralBad = selectedWarehouse?.scope === 'SYSTEM';
    if (!warehouseId) {
      toast.error('Pilih gudang sumber');
      return;
    }
    if (!isCentralBad && !outletId) {
      toast.error('Pilih outlet terlebih dahulu');
      return;
    }
    if (!reason.trim()) {
      toast.error('Alasan stok keluar wajib diisi');
      return;
    }
    if (items.length === 0) {
      toast.error('Tambahkan minimal satu produk');
      return;
    }
    for (const l of items) {
      if (l.quantity <= 0) {
        toast.error(`Jumlah untuk "${l.name}" harus lebih dari nol`);
        return;
      }
      if (l.quantity > l.availableQuantity) {
        toast.error(
          `Jumlah untuk "${l.name}" melebihi stok tersedia (${l.availableQuantity})`,
        );
        return;
      }
    }
    mutation.mutate({
      outletId: isCentralBad ? undefined : outletId,
      warehouseId,
      date: documentDate,
      reason: reason.trim(),
      items: items.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitId: l.unitId || undefined,
        stockValue: l.stockValue,
      })),
    });
  };

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader
        title="Stok Keluar"
        subtitle="Pencatatan stok keluar non-penjualan (buang, kadaluarsa, rusak, koreksi stok)"
      />

      {/* IGDERP-97 (I4): Excel import/export — same template, round-trip */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Import Excel
        </Button>
        <Button type="button" variant="outline" onClick={handleExport} disabled={!warehouseId || exporting}>
          <Download className="w-4 h-4 mr-2" />
          {exporting ? 'Mengunduh…' : 'Export Excel'}
        </Button>
      </div>
      <StockImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        kind="out"
        onImported={() => queryClient.invalidateQueries({ queryKey: ['stock-out-docs'] })}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Header: Informasi Stok Keluar ── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Informasi Stok Keluar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Outlet
                {selectedWarehouse?.scope !== 'SYSTEM' && (
                  <span className="text-red-500 dark:text-red-400"> *</span>
                )}
              </Label>
              <Select
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
                disabled={selectedWarehouse?.scope === 'SYSTEM'}
              >
                <option value="">
                  {selectedWarehouse?.scope === 'SYSTEM'
                    ? 'Tidak diperlukan'
                    : 'Pilih Outlet'}
                </option>
                {(branches as any[]).map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </Select>
              {selectedWarehouse?.scope === 'SYSTEM' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Central Bad Stock tidak memerlukan outlet.
                </p>
              )}
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gudang Sumber <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              <Select
                value={warehouseId}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                required
              >
                <option value="">Pilih Gudang</option>
                {warehouses.map((w: StockOutWarehouse) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                    {w.scope === 'SYSTEM' ? ' — Pusat Barang Rusak' : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tanggal</Label>
              <Input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Alasan <span className="text-red-500 dark:text-red-400">*</span>
            </Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Barang kadaluarsa, rusak, tidak layak jual"
              required
            />
          </div>
        </div>

        {/* ── Product picker ── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            Tambah Produk
          </h2>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Cari produk (nama, SKU, atau barcode)..."
              className="pl-10"
            />
            {productSearch.trim().length >= 2 && productResults.length > 0 && (
              <div className="absolute z-20 mt-2 w-full border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 shadow-lg max-h-60 overflow-y-auto">
                {productResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="w-full px-4 py-3 text-left hover:bg-primary-50 dark:hover:bg-primary-950 border-b border-gray-100 dark:border-gray-800 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      SKU: {p.sku}
                      {p.barcode ? ` • Barcode: ${p.barcode}` : ''}
                    </div>
                    <div className="text-xs mt-1">
                      <span className="text-primary-600 dark:text-primary-400">
                        HJM: {formatCurrency(p.minSellingPrice ?? p.sellingPrice)}
                      </span>
                      <span
                        className={
                          p.availableQuantity > 0
                            ? 'text-emerald-600 dark:text-emerald-400 ml-3'
                            : 'text-red-500 dark:text-red-400 ml-3'
                        }
                      >
                        Stok tersedia: {p.availableQuantity}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Lines table ── */}
        {items.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Daftar Produk</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Produk</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase w-24">Stok</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase w-24">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase w-32">Satuan</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase w-40">Nilai Stok</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((line) => (
                    <tr key={line.productId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{line.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          SKU: {line.sku}
                          {line.barcode ? ` • Barcode: ${line.barcode}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {line.availableQuantity}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">tersedia</div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0.001"
                          step="any"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.productId, {
                              quantity: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-9 w-24 text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={line.unitId}
                          onChange={(e) => {
                            const u = (units as any[]).find((x: any) => x.id === e.target.value);
                            updateLine(line.productId, {
                              unitId: e.target.value,
                              unitName: u?.name || '',
                            });
                          }}
                          className="h-9"
                        >
                          <option value="">-</option>
                          {(units as any[]).map((u: any) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={line.stockValue}
                          onChange={(e) =>
                            updateLine(line.productId, {
                              stockValue: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-9 w-36 text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(line.quantity * line.stockValue)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => removeLine(line.productId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Nilai:</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/inventory/stock')}
          >
            <X className="w-4 h-4 mr-2" />
            Batal
          </Button>
          <Button type="submit" disabled={mutation.isPending || items.length === 0}>
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Simpan Stok Keluar
              </>
            )}
          </Button>
        </div>
      </form>

      {/* ── Recent documents ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          Riwayat Stok Keluar
        </h2>
        {recentDocs.data.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada dokumen stok keluar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">No. Dokumen</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Outlet</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Gudang</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Alasan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentDocs.data.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{doc.documentNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(doc.documentDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {doc.outlet?.name || 'Central Bad Stock'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{doc.warehouse?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[220px] truncate">{doc.reason}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">
                      {formatCurrency(doc.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
