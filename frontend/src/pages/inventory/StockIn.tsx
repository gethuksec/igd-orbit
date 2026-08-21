import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  X,
  Loader2,
  PackagePlus,
  Search,
  Plus,
  Trash2,
  ArrowDownToLine,
  History,
} from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { api } from '../../services/api';
import {
  inventoryService,
} from '../../services/inventory.service';
import type {
  StockInProduct,
  StockInTier,
  StockInWarehouse,
} from '../../services/inventory.service';
import { productsService } from '../../services/products.service';

const NO_SUPPLIER = 'NO_SUPPLIER';

interface LineItem {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unitId: string;
  unitName: string;
  stockValue: number;
}

interface AddProductForm {
  name: string;
  categoryId: string;
  sellingPrice: number;
  barcode: string;
  unitId: string;
  minSellingPrice: number;
  tierPrices: Record<string, number>;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function StockIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [outletId, setOutletId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [documentDate, setDocumentDate] = useState(todayISO());
  const [reason, setReason] = useState('');

  const [items, setItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Add Product dialog state
  const [showAddProduct, setShowAddProduct] = useState(false);

  // ── Supporting lists ──
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['stock-in-warehouses', outletId],
    queryFn: () => inventoryService.getStockInWarehouses(outletId || undefined),
    enabled: !!outletId,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await api.get('/suppliers');
      return res.data.data || res.data;
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const res = await api.get('/units');
      return res.data.data || res.data;
    },
  });

  const { data: productResults = [] } = useQuery({
    queryKey: ['stock-in-products', productSearch],
    queryFn: () => inventoryService.searchStockInProducts(productSearch.trim()),
    enabled: productSearch.trim().length >= 2,
  });

  const { data: recentDocs = { data: [], meta: { total: 0 } } } = useQuery({
    queryKey: ['stock-in-docs'],
    queryFn: () => inventoryService.getStockIns({ page: 1, limit: 10 }),
  });

  // Auto-select first GOOD warehouse of the outlet
  useEffect(() => {
    setWarehouseId('');
    if (warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [outletId, warehouses]);

  const addProductToLines = (product: StockInProduct, quantity = 1) => {
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
        },
      ];
    });
  };

  const handleSelectProduct = (product: StockInProduct) => {
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
    mutationFn: (data: any) => inventoryService.createStockIn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-in-docs'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast.success('Stok masuk berhasil disimpan');
      setItems([]);
      setReason('');
      setSupplierId('');
      setProductSearch('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan saat menyimpan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletId) {
      toast.error('Pilih outlet terlebih dahulu');
      return;
    }
    if (!warehouseId) {
      toast.error('Pilih gudang tujuan');
      return;
    }
    if (!reason.trim()) {
      toast.error('Alasan stok masuk wajib diisi');
      return;
    }
    if (items.length === 0) {
      toast.error('Tambahkan minimal satu produk');
      return;
    }
    mutation.mutate({
      outletId,
      warehouseId,
      supplierId: supplierId || NO_SUPPLIER,
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
        title="Stok Masuk"
        subtitle="Pencatatan stok masuk non-pembelian (stok awal, barang hadiah, dll)"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Header: Informasi Stok Masuk ── */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary-600" />
            Informasi Stok Masuk
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                Gudang Tujuan <span className="text-red-500">*</span>
              </Label>
              <Select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                disabled={!outletId}
                required
              >
                <option value="">{outletId ? 'Pilih Gudang' : 'Pilih outlet dahulu'}</option>
                {warehouses.map((w: StockInWarehouse) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Supplier</Label>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value={NO_SUPPLIER}>Tanpa Supplier</option>
                {(suppliers as any[]).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</Label>
              <Input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Alasan <span className="text-red-500">*</span>
            </Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Stok awal toko, barang hadiah, barang lama/temuan"
              required
            />
          </div>
        </div>

        {/* ── Product picker ── */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-primary-600" />
            Tambah Produk
          </h2>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Cari produk (nama, SKU, atau barcode)..."
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
                      <div className="text-xs text-primary-600 mt-1">
                        HJM: {formatCurrency(p.minSellingPrice ?? p.sellingPrice)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button type="button" onClick={() => setShowAddProduct(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Produk Baru
            </Button>
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
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-24">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-32">Satuan</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-40">Nilai Stok</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total</th>
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
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(line.quantity * line.stockValue)}
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
              <span className="text-gray-600">Total Nilai:</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(totalValue)}</span>
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
                Simpan Stok Masuk
              </>
            )}
          </Button>
        </div>
      </form>

      {/* ── Recent documents ── */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary-600" />
          Riwayat Stok Masuk
        </h2>
        {recentDocs.data.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada dokumen stok masuk.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">No. Dokumen</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Outlet</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Gudang</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Alasan</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentDocs.data.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{doc.documentNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(doc.documentDate).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.outlet?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{doc.warehouse?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.supplierId === NO_SUPPLIER ? 'Tanpa Supplier' : doc.supplierName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[220px] truncate">{doc.reason}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(doc.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddProductDialog
        open={showAddProduct}
        onOpenChange={setShowAddProduct}
        onCreated={(product) => {
          addProductToLines(product);
          setShowAddProduct(false);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Add Product quick-create dialog
// ─────────────────────────────────────────────────────────────
function AddProductDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (product: StockInProduct) => void;
}) {
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories', { params: { limit: 200 } });
      return res.data.data || res.data;
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const res = await api.get('/units');
      return res.data.data || res.data;
    },
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ['stock-in-tiers'],
    queryFn: () => inventoryService.getStockInTiers(),
    enabled: open,
  });

  const [form, setForm] = useState<AddProductForm>({
    name: '',
    categoryId: '',
    sellingPrice: 0,
    barcode: '',
    unitId: '',
    minSellingPrice: 0,
    tierPrices: {},
  });

  // Default category to the first active category when the dialog opens
  useEffect(() => {
    if (open && !form.categoryId && (categories as any[]).length > 0) {
      setForm((prev) => ({ ...prev, categoryId: (categories as any[])[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categories]);

  // Auto-fill Harga Jual Minimum from the Silver tier price (or base price)
  useEffect(() => {
    const silverTier = (tiers as StockInTier[]).find(
      (t) => t.code === 'SILVER' || t.name?.toLowerCase() === 'silver',
    );
    const silverPrice = silverTier ? form.tierPrices[silverTier.id] : undefined;
    const autoMin =
      typeof silverPrice === 'number' && silverPrice > 0 ? silverPrice : form.sellingPrice;
    if (form.minSellingPrice !== autoMin && autoMin > 0) {
      setForm((prev) => ({ ...prev, minSellingPrice: autoMin }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.sellingPrice, form.tierPrices, tiers]);

  const resetForm = () => {
    setForm({
      name: '',
      categoryId: (categories as any[])[0]?.id || '',
      sellingPrice: 0,
      barcode: '',
      unitId: '',
      minSellingPrice: 0,
      tierPrices: {},
    });
  };

  const mutation = useMutation({
    mutationFn: (data: any) => productsService.create(data),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-in-products'] });
      toast.success(`Produk "${product.name}" berhasil dibuat`);
      const mapped: StockInProduct = {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || null,
        sellingPrice: Number(product.sellingPrice || 0),
        minSellingPrice: product.minSellingPrice != null ? Number(product.minSellingPrice) : null,
        unitId: (product as any).unitId || form.unitId || null,
      };
      onCreated(mapped);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat produk');
    },
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Nama produk wajib diisi');
      return;
    }
    if (!form.categoryId) {
      toast.error('Kategori produk wajib diisi');
      return;
    }
    if (!form.sellingPrice || form.sellingPrice <= 0) {
      toast.error('Harga jual wajib diisi');
      return;
    }
    const memberPricing: Record<string, number> = {};
    for (const [tierId, price] of Object.entries(form.tierPrices)) {
      if (price > 0) memberPricing[tierId] = price;
    }
    mutation.mutate({
      name: form.name.trim(),
      categoryId: form.categoryId,
      sellingPrice: form.sellingPrice,
      costPrice: 0,
      minSellingPrice: form.minSellingPrice > 0 ? form.minSellingPrice : undefined,
      barcode: form.barcode.trim() || undefined,
      unitId: form.unitId || undefined,
      memberPricing: Object.keys(memberPricing).length > 0 ? memberPricing : null,
      isActive: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Produk Baru</DialogTitle>
          <DialogDescription>
            Buat produk baru lalu tambahkan langsung ke baris stok masuk ini.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Nama Produk <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contoh: iPhone 15 Pro 128GB"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Kategori <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {(categories as any[]).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Harga Jual <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={form.sellingPrice || ''}
              onChange={(e) =>
                setForm({ ...form, sellingPrice: parseFloat(e.target.value) || 0 })
              }
              placeholder="0"
            />
          </div>
          {(tiers as StockInTier[]).map((tier) => (
            <div key={tier.id}>
              <Label className="block text-sm font-medium text-gray-700 mb-2">
                Harga Tier {tier.name}
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.tierPrices[tier.id] || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tierPrices: {
                      ...form.tierPrices,
                      [tier.id]: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0"
              />
            </div>
          ))}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Barcode</Label>
            <Input
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              placeholder="Opsional"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">Satuan</Label>
            <Select
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
            >
              <option value="">-</option>
              {(units as any[]).map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Harga Jual Minimum
            </Label>
            <Input
              type="number"
              min="0"
              step="any"
              value={form.minSellingPrice || ''}
              onChange={(e) =>
                setForm({ ...form, minSellingPrice: parseFloat(e.target.value) || 0 })
              }
              placeholder="Otomatis dari harga tier Silver"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nilai stok pada baris stok masuk akan mengikuti Harga Jual Minimum ini.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 mt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Menyimpan...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Buat & Tambahkan
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
