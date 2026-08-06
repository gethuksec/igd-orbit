import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Loader2,
  Package,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { productsService } from '../../services/products.service';
import { useBranchFilter } from '@/components/branch/BranchFilter';
import { toast } from 'sonner';
import { api } from '@/services/api';

export default function StockAdjustment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { branchId } = useBranchFilter();

  const [formData, setFormData] = useState({
    // D7: default = first-in-list branch (hook)
    branchId: branchId || '',
    productId: '',
    type: 'IN' as 'IN' | 'OUT' | 'DAMAGE' | 'FOUND' | 'CORRECTION',
    quantityChange: 1,
    reason: '',
    notes: '',
    batchNumber: '',
    serialNumber: '',
  });

  const [productSearch, setProductSearch] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', 'search', productSearch],
    queryFn: () =>
      productsService.getAll({
        page: 1,
        limit: 10,
        search: productSearch || undefined,
      }),
    enabled: productSearch.length > 2,
  });

  const { data: currentStock } = useQuery({
    queryKey: ['product-stock', formData.productId, formData.branchId],
    queryFn: () => inventoryService.getProductStock(formData.productId),
    enabled: !!formData.productId && !!formData.branchId,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => inventoryService.adjustStock(data),
    onSuccess: () => {
      toast.success('Penyesuaian stok berhasil');
      queryClient.invalidateQueries({ queryKey: ['product-stocks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      navigate('/inventory/stock');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal melakukan penyesuaian stok');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.productId || !formData.branchId) {
      toast.error('Pilih produk dan cabang');
      return;
    }

    if (!formData.reason.trim()) {
      toast.error('Alasan penyesuaian wajib diisi');
      return;
    }

    if (formData.type === 'OUT' || formData.type === 'DAMAGE') {
      const available = currentStock?.stocks?.find((s: any) => s.branchId === formData.branchId)
        ?.quantityAvailable || 0;
      if (formData.quantityChange > available) {
        toast.error(`Stok tidak mencukupi. Stok tersedia: ${available}`);
        return;
      }
    }

    mutation.mutate({
      productId: formData.productId,
      branchId: formData.branchId,
      type: formData.type,
      quantityChange: formData.quantityChange,
      reason: formData.reason,
      notes: formData.notes || undefined,
      batchNumber: formData.batchNumber || undefined,
      serialNumber: formData.serialNumber || undefined,
    });
  };

  const currentStockQty =
    currentStock?.stocks?.find((s: any) => s.branchId === formData.branchId)?.quantityAvailable || 0;
  const newStockQty =
    formData.type === 'OUT' || formData.type === 'DAMAGE'
      ? currentStockQty - formData.quantityChange
      : formData.type === 'IN' || formData.type === 'FOUND' || formData.type === 'CORRECTION'
        ? currentStockQty + formData.quantityChange
        : currentStockQty;

  const selectedProduct = productsData?.data?.find((p: any) => p.id === formData.productId);

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <BreadcrumbHeader title="Penyesuaian Stok" subtitle="Lakukan penyesuaian stok produk" />

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Product & Branch Selection */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Pilih Produk & Cabang
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Produk <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onFocus={() => {
                    if (!formData.productId) setProductSearch('');
                  }}
                  onBlur={() => {
                    // Delay to allow onClick to fire first
                    setTimeout(() => {
                      if (formData.productId) {
                        const selected = productsData?.data?.find((p: any) => p.id === formData.productId);
                        if (selected) setProductSearch(selected.name);
                      }
                    }, 200);
                  }}
                  placeholder="Cari produk (nama atau SKU)..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {productSearch.length > 2 && !formData.productId && productsData?.data && (
                  <div className="absolute z-50 w-full mt-1 border border-gray-200 rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto">
                    {productsData.data.map((product: any) => (
                      <button
                        key={product.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent onBlur from firing
                          setFormData({ ...formData, productId: product.id });
                          setProductSearch(product.name);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedProduct && (
                <div className="mt-2 text-sm text-gray-600">
                  Dipilih: <span className="font-semibold">{selectedProduct.name}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Pilih Cabang</option>
                {branches?.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Adjustment Details */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary-600" />
            Detail Penyesuaian
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipe Penyesuaian <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as 'IN' | 'OUT' | 'DAMAGE' | 'FOUND' | 'CORRECTION',
                  })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="IN">Stok Masuk (IN)</option>
                <option value="OUT">Stok Keluar (OUT)</option>
                <option value="DAMAGE">Rusak (DAMAGE)</option>
                <option value="FOUND">Ditemukan (FOUND)</option>
                <option value="CORRECTION">Koreksi (CORRECTION)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantityChange}
                onChange={(e) =>
                  setFormData({ ...formData, quantityChange: parseInt(e.target.value) || 1 })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alasan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Contoh: Stok ditemukan di gudang, Stok rusak, dll"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Tambahkan catatan tambahan..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Batch Number</label>
                <input
                  type="text"
                  value={formData.batchNumber}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Serial Number</label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stock Preview */}
        {formData.productId && formData.branchId && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Preview Stok
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-blue-700 mb-1">Stok Saat Ini</p>
                <p className="text-2xl font-bold text-blue-900">{currentStockQty}</p>
              </div>
              <div className="flex items-center justify-center">
                {formData.type === 'OUT' || formData.type === 'DAMAGE' ? (
                  <TrendingDown className="w-8 h-8 text-red-600" />
                ) : (
                  <TrendingUp className="w-8 h-8 text-green-600" />
                )}
                <span className="ml-2 text-lg font-semibold text-blue-900">
                  {formData.type === 'OUT' || formData.type === 'DAMAGE' ? '-' : '+'}
                  {formData.quantityChange}
                </span>
              </div>
              <div>
                <p className="text-sm text-blue-700 mb-1">Stok Setelah Penyesuaian</p>
                <p
                  className={`text-2xl font-bold ${
                    newStockQty < 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {newStockQty < 0 ? 0 : newStockQty}
                </p>
                {newStockQty < 0 && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Stok tidak boleh negatif
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/inventory/stock')}
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || newStockQty < 0}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Penyesuaian</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

