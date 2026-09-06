import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  X,
  Loader2,
  ArrowRight,
  Search,
  Trash2,
  History,
  Package,
  Warehouse,
} from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventory.service';
import type {
  StockTransfer,
  StockTransferWarehouse,
  TransferStockProduct,
} from '../../services/inventory.service';

interface LineItem {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unitName: string;
  availableQuantity: number;
}

const warehouseLabel = (w: StockTransferWarehouse) => {
  const context =
    w.scope === 'SYSTEM'
      ? 'Pusat'
      : w.outlet
        ? `${w.outlet.name}`
        : 'Outlet';
  return `${w.name} (${w.code}) — ${context}`;
};

/**
 * Mutasi (IGDERP-140) — central (central-good / central-bad) ↔ outlet
 * warehouse, plus outlet ↔ outlet. Executed by SODO; permission
 * inventory.mutasi. Quantity-only, atomic OUT/IN.
 */
export default function Mutasi() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // All move-endpoint warehouses: system central (good/bad) + outlet GOOD
  const { data: warehouses = [] } = useQuery({
    queryKey: ['mutasi-warehouses'],
    queryFn: () => inventoryService.getMutasiWarehouses(),
  });

  const { data: productResults = [] } = useQuery({
    queryKey: ['mutasi-products', productSearch, fromWarehouseId],
    queryFn: () =>
      inventoryService.searchTransferProducts(
        productSearch.trim(),
        15,
        fromWarehouseId || undefined,
      ),
    enabled: productSearch.trim().length >= 2,
  });

  const { data: recentDocs = { data: [], meta: { total: 0 } } } = useQuery({
    queryKey: ['mutasi-docs'],
    queryFn: () => inventoryService.getMutasi({ page: 1, limit: 10 }),
  });

  useEffect(() => {
    setItems([]);
  }, [fromWarehouseId]);

  const addProductToLines = (product: TransferStockProduct, quantity = 1) => {
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
          unitName: product.unit?.name || '',
          availableQuantity: product.availableQuantity ?? 0,
        },
      ];
    });
  };

  const handleSelectProduct = (product: TransferStockProduct) => {
    if (product.availableQuantity <= 0) {
      toast.error(`Stok "${product.name}" tidak tersedia di gudang asal`);
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

  const totalQty = useMemo(
    () => items.reduce((sum, l) => sum + l.quantity, 0),
    [items],
  );

  const mutation = useMutation({
    mutationFn: (data: any) => inventoryService.createMutasi(data),
    onSuccess: (transfer: StockTransfer) => {
      queryClient.invalidateQueries({ queryKey: ['mutasi-docs'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast.success('Mutasi stok berhasil disimpan');
      navigate(`/inventory/mutasi/${transfer.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan saat menyimpan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromWarehouseId) {
      toast.error('Pilih gudang asal');
      return;
    }
    if (!toWarehouseId) {
      toast.error('Pilih gudang tujuan');
      return;
    }
    if (toWarehouseId === fromWarehouseId) {
      toast.error('Gudang tujuan harus berbeda dari gudang asal');
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
      fromWarehouseId,
      toWarehouseId,
      notes: notes.trim() || undefined,
      items: items.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
      })),
    });
  };

  const selectedFrom = warehouses.find((w: StockTransferWarehouse) => w.id === fromWarehouseId);
  const selectedTo = warehouses.find((w: StockTransferWarehouse) => w.id === toWarehouseId);

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader
        title="Mutasi Stok"
        subtitle="Pindahkan barang antara gudang pusat (central-good / central-bad) dan gudang outlet, atau antar outlet (kuantitas saja)"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Header: Informasi Mutasi ── */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-primary-600" />
            Informasi Mutasi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Gudang Asal <span className="text-red-500">*</span>
              </Label>
              <Select
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(e.target.value)}
                required
              >
                <option value="">Pilih Gudang Asal</option>
                {warehouses.map((w: StockTransferWarehouse) => (
                  <option key={w.id} value={w.id}>
                    {warehouseLabel(w)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Gudang Tujuan <span className="text-red-500">*</span>
              </Label>
              <Select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                required
              >
                <option value="">Pilih Gudang Tujuan</option>
                {warehouses
                  .filter((w: StockTransferWarehouse) => w.id !== fromWarehouseId)
                  .map((w: StockTransferWarehouse) => (
                    <option key={w.id} value={w.id}>
                      {warehouseLabel(w)}
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label className="block text-sm font-medium text-gray-700 mb-2">Catatan</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan mutasi (opsional)"
            />
          </div>
        </div>

        {/* ── Product picker ── */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Tambah Produk
          </h2>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              disabled={!fromWarehouseId}
              placeholder={
                fromWarehouseId
                  ? 'Cari produk (nama, SKU, atau barcode)...'
                  : 'Pilih gudang asal terlebih dahulu'
              }
              className="pl-10"
            />
            {productSearch.trim().length >= 2 && productResults.length > 0 && (
              <div className="absolute z-20 mt-2 w-full border border-gray-200 rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto">
                {productResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="w-full px-4 py-3 text-left hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-sm text-gray-500">
                      SKU: {p.sku}
                      {p.barcode ? ` • Barcode: ${p.barcode}` : ''}
                    </div>
                    <div className="text-xs mt-1">
                      <span
                        className={
                          p.availableQuantity > 0
                            ? 'text-emerald-600'
                            : 'text-red-500'
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
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Daftar Produk</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Produk</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-24">Stok</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-24">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-32">Satuan</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((line) => (
                    <tr key={line.productId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{line.name}</div>
                        <div className="text-xs text-gray-500">
                          SKU: {line.sku}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {line.availableQuantity}
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min={1}
                          step="any"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.productId, {
                              quantity: Number(e.target.value),
                            })
                          }
                          className="w-24"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{line.unitName || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(line.productId)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Summary + submit ── */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">
                    {selectedFrom ? warehouseLabel(selectedFrom) : '-'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-800">
                    {selectedTo ? warehouseLabel(selectedTo) : '-'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  Total {totalQty} unit • {items.length} produk
                </span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/inventory/mutasi')}>
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={mutation.isPending || items.length === 0}
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Simpan Mutasi
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Recent documents ── */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <History className="w-5 h-5 text-primary-600" />
              Riwayat Terbaru
            </h2>
            <Button variant="link" onClick={() => navigate('/inventory/mutasi')}>
              Lihat Semua
            </Button>
          </div>
          {recentDocs.data.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada dokumen mutasi.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentDocs.data.slice(0, 5).map((doc: StockTransfer) => (
                <button
                  key={doc.id}
                  type="button"
                  className="w-full py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => navigate(`/inventory/mutasi/${doc.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-600">
                      {doc.transferNumber}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(doc.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {doc.fromWarehouse?.name} → {doc.toWarehouse?.name} •{' '}
                    {doc.items.length} produk
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
