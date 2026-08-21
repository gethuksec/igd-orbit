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

type DestinationMode = 'outlet' | 'central_bad';

export default function StockTransfer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [outletId, setOutletId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [destinationMode, setDestinationMode] = useState<DestinationMode>('outlet');
  const [toOutletId, setToOutletId] = useState('');
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

  // Source warehouses: GOOD OUTLET warehouses filtered by the source outlet
  const { data: sourceWarehouses = [] } = useQuery({
    queryKey: ['transfer-warehouses', outletId],
    queryFn: () => inventoryService.getTransferWarehouses(outletId || undefined),
  });

  // Destination warehouses (outlet mode): filtered by the destination outlet
  const { data: destWarehouses = [] } = useQuery({
    queryKey: ['transfer-warehouses', toOutletId],
    queryFn: () => inventoryService.getTransferWarehouses(toOutletId || undefined),
    enabled: destinationMode === 'outlet' && !!toOutletId,
  });

  const { data: centralBad = null } = useQuery({
    queryKey: ['transfer-central-bad'],
    queryFn: () => inventoryService.getCentralBadWarehouse(),
    enabled: destinationMode === 'central_bad',
  });

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
    setItems([]);
    if (outletId && sourceWarehouses.length > 0) {
      setWarehouseId(sourceWarehouses[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, sourceWarehouses]);

  // Clear destination when the mode changes
  useEffect(() => {
    setToOutletId('');
    setToWarehouseId('');
  }, [destinationMode]);

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
      toast.error('Pilih outlet sumber');
      return;
    }
    if (!warehouseId) {
      toast.error('Pilih gudang sumber');
      return;
    }
    if (destinationMode === 'outlet') {
      if (!toOutletId) {
        toast.error('Pilih outlet tujuan');
        return;
      }
      if (!toWarehouseId) {
        toast.error('Pilih gudang tujuan');
        return;
      }
    } else if (!centralBad) {
      toast.error('Central Bad Stock belum tersedia di sistem');
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
      destinationMode,
      toOutletId: destinationMode === 'outlet' ? toOutletId : undefined,
      toWarehouseId: destinationMode === 'outlet' ? toWarehouseId : undefined,
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
        subtitle="Pindahkan stok antar outlet atau ke Central Bad Stock (kuantitas saja)"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Header: Informasi Transfer ── */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary-600" />
            Informasi Transfer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Outlet Sumber <span className="text-red-500">*</span>
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
                Mode Tujuan <span className="text-red-500">*</span>
              </Label>
              <Select
                value={destinationMode}
                onChange={(e) => setDestinationMode(e.target.value as DestinationMode)}
                required
              >
                <option value="outlet">Gudang Outlet</option>
                <option value="central_bad">Central Bad Stock</option>
              </Select>
            </div>
          </div>

          {destinationMode === 'outlet' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Outlet Tujuan <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={toOutletId}
                  onChange={(e) => {
                    setToOutletId(e.target.value);
                    setToWarehouseId('');
                  }}
                  required
                >
                  <option value="">Pilih Outlet</option>
                  {(branches as any[])
                    .filter((b: any) => b.id !== outletId)
                    .map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
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
                  disabled={!toOutletId}
                  required
                >
                  <option value="">Pilih Gudang</option>
                  {destWarehouses.map((w: StockTransferWarehouse) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </Select>
                {toOutletId && destWarehouses.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    Outlet tujuan belum memiliki gudang aktif.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-sm font-medium text-gray-900">
                {centralBad ? (
                  <>
                    Tujuan: <span className="font-semibold">{centralBad.name}</span>{' '}
                    <span className="text-gray-500">({centralBad.code})</span>
                    <span className="ml-2 text-xs text-amber-700">
                      — pusat barang rusak sistem, tidak memerlukan outlet.
                    </span>
                  </>
                ) : (
                  <span className="text-amber-700">Memuat Central Bad Stock...</span>
                )}
              </div>
            </div>
          )}

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
                          {line.barcode ? ` • Barcode: ${line.barcode}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-gray-700">
                          {line.availableQuantity}
                        </div>
                        <div className="text-xs text-gray-400">tersedia</div>
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
                        <div className="text-sm text-gray-600">
                          {line.unitName || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
              <span className="text-gray-600">Total Barang:</span>
              <span className="text-lg font-bold text-gray-900">{totalQty}</span>
            </div>
          </div>
        )}

        {/* ── Route summary + actions ── */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              {selectedSource ? (
                <>
                  <span className="font-semibold">{selectedSource.name}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  {destinationMode === 'outlet' ? (
                    <span className="font-semibold">
                      {selectedDest ? selectedDest.name : 'Pilih gudang tujuan'}
                    </span>
                  ) : (
                    <span className="font-semibold">
                      {centralBad ? centralBad.name : 'Central Bad Stock'}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-400">Pilih rute transfer</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/inventory/transfer')}
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
                    Simpan Transfer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* ── Recent documents ── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary-600" />
          Riwayat Transfer
        </h2>
        {recentDocs.data.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada dokumen transfer.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">No. Transfer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Dari</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Ke</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Jumlah Produk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentDocs.data.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/inventory/transfer/${doc.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-primary-600">
                      {doc.transferNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(doc.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.fromWarehouse?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.toWarehouse?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {doc.items.length}
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
