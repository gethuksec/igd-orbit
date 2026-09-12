import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  X,
  Loader2,
  ArrowRightLeft,
  Search,
  Trash2,
  ArrowRight,
  History,
  Package,
} from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '../../services/api';
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

/**
 * Transfer Stock v2 — INTRA-OUTLET (IGDERP-139).
 * Same outlet, warehouse ↔ warehouse (e.g., Gudang Service ↔ Gudang
 * Penjualan). Cross-outlet and централ moves live under Mutasi (IGDERP-140).
 */
export default function StockTransfer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [outletId, setOutletId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // ── Supporting lists ──
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  // Source AND destination warehouses: GOOD OUTLET warehouses of the source outlet
  const { data: sourceWarehouses = [] } = useQuery({
    queryKey: ['transfer-warehouses', outletId],
    queryFn: () => inventoryService.getTransferWarehouses(outletId || undefined),
    enabled: !!outletId,
  });

  // Destination options: same outlet, excluding the selected source
  const destWarehouses = useMemo(
    () => sourceWarehouses.filter((w: StockTransferWarehouse) => w.id !== warehouseId),
    [sourceWarehouses, warehouseId],
  );

  const { data: productResults = [] } = useQuery({
    queryKey: ['transfer-products', productSearch, warehouseId],
    queryFn: () =>
      inventoryService.searchTransferProducts(
        productSearch.trim(),
        15,
        warehouseId || undefined,
      ),
    enabled: productSearch.trim().length >= 2,
  });

  const { data: recentDocs = { data: [], meta: { total: 0 } } } = useQuery({
    queryKey: ['transfer-docs'],
    queryFn: () => inventoryService.getTransfers({ page: 1, limit: 10 }),
  });

  // Auto-select the first source warehouse when the source outlet changes
  useEffect(() => {
    setWarehouseId('');
    setToWarehouseId('');
    setItems([]);
    if (outletId && sourceWarehouses.length > 0) {
      setWarehouseId(sourceWarehouses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, sourceWarehouses]);

  // When the source changes, reset the destination to the first other warehouse
  useEffect(() => {
    if (destWarehouses.length > 0 && !destWarehouses.some((w) => w.id === toWarehouseId)) {
      setToWarehouseId(destWarehouses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, destWarehouses]);

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
      toast.error(`Stok "${product.name}" tidak tersedia di gudang sumber`);
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
    mutationFn: (data: any) => inventoryService.createTransferStock(data),
    onSuccess: (transfer: StockTransfer) => {
      queryClient.invalidateQueries({ queryKey: ['transfer-docs'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast.success('Transfer stok berhasil disimpan');
      navigate(`/inventory/transfer/${transfer.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan saat menyimpan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!outletId) {
      toast.error('Pilih outlet');
      return;
    }
    if (!warehouseId) {
      toast.error('Pilih gudang sumber');
      return;
    }
    if (!toWarehouseId) {
      toast.error('Pilih gudang tujuan');
      return;
    }
    if (toWarehouseId === warehouseId) {
      toast.error('Gudang tujuan harus berbeda dari gudang sumber');
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
      outletId,
      warehouseId,
      toWarehouseId,
      notes: notes.trim() || undefined,
      items: items.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
      })),
    });
  };

  const selectedSource = sourceWarehouses.find((w: StockTransferWarehouse) => w.id === warehouseId);
  const selectedDest = destWarehouses.find((w: StockTransferWarehouse) => w.id === toWarehouseId);

  return (
    <div className="w-full space-y-4">
      <BreadcrumbHeader
        title="Transfer Stok"
        subtitle="Pindahkan barang antar gudang dalam satu outlet (kuantitas saja) — mis. Gudang Service ↔ Gudang Penjualan"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Header: Informasi Transfer ── */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary-600" />
            Informasi Transfer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Outlet <span className="text-red-500">*</span>
              </Label>
              <Select value={outletId} onChange={(e) => setOutletId(e.target.value)} required>
                <option value="">Pilih Outlet</option>
                {(branches as any[]).map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Gudang Sumber <span className="text-red-500">*</span>
              </Label>
              <Select
                value={warehouseId}
                onChange={(e) => {
                  setWarehouseId(e.target.value);
                  setItems([]);
                }}
                disabled={!outletId}
                required
              >
                <option value="">Pilih Gudang</option>
                {sourceWarehouses.map((w: StockTransferWarehouse) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </Select>
              {outletId && sourceWarehouses.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Outlet ini belum memiliki gudang aktif.
                </p>
              )}
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Gudang Tujuan <span className="text-red-500">*</span>
              </Label>
              <Select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                disabled={!warehouseId}
                required
              >
                <option value="">Pilih Gudang</option>
                {destWarehouses.map((w: StockTransferWarehouse) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </Select>
              {warehouseId && destWarehouses.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Tidak ada gudang lain di outlet ini. Untuk pindah ke outlet lain
                  atau gudang pusat, gunakan menu Mutasi.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Label className="block text-sm font-medium text-gray-700 mb-2">Catatan</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan transfer (opsional)"
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
              disabled={!warehouseId}
              placeholder={
                warehouseId
                  ? 'Cari produk (nama, SKU, atau barcode)...'
                  : 'Pilih gudang sumber terlebih dahulu'
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
                    {selectedSource?.name || '-'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-800">
                    {selectedDest?.name || '-'}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  Total {totalQty} unit • {items.length} produk
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/inventory/transfer')}
                >
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
                {/* IGDERP-172: cross-outlet handoff — carry lines to the Mutasi form */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={items.length === 0}
                  title="Pindah ke outlet lain atau gudang pusat via Mutasi (baris ikut terbawa)"
                  onClick={() =>
                    navigate('/inventory/mutasi/new', {
                      state: {
                        fromTransfer: {
                          fromWarehouseId: warehouseId,
                          notes,
                          items: items.map((l) => ({ ...l })),
                        },
                      },
                    })
                  }
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Sebagai Mutasi
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
                  Simpan Transfer
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
            <Button variant="link" onClick={() => navigate('/inventory/transfer')}>
              Lihat Semua
            </Button>
          </div>
          {recentDocs.data.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada dokumen transfer.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentDocs.data.slice(0, 5).map((doc: StockTransfer) => (
                <button
                  key={doc.id}
                  type="button"
                  className="w-full py-3 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => navigate(`/inventory/transfer/${doc.id}`)}
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
