import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  X,
  Loader2,
  Package,
  Truck,
  Plus,
  Trash2,
  Search,
} from 'lucide-react';
import { inventoryService } from '../../services/inventory.service';
import { productsService } from '../../services/products.service';
import { api } from '../../services/api';
import { toast } from 'sonner';

export default function StockTransfer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    fromBranchId: '',
    toBranchId: '',
    notes: '',
  });

  const [items, setItems] = useState<Array<{ productId: string; quantity: number; product?: any }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; sku: string } | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data.data || res.data;
    },
  });

  // Fetch products for search
  const [productSearch, setProductSearch] = useState('');
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

  // Fetch stock for selected product and from branch
  const { data: productStockData } = useQuery({
    queryKey: ['product-stock', selectedProduct?.id, formData.fromBranchId],
    queryFn: () => inventoryService.getProductStock(selectedProduct!.id),
    enabled: !!selectedProduct?.id && !!formData.fromBranchId,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => inventoryService.createTransfer(data),
    onSuccess: (transfer) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transfers'] });
      toast.success('Transfer stok berhasil dibuat');
      navigate(`/inventory/transfer/${transfer.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan');
    },
  });

  const handleAddItem = () => {
    if (!selectedProduct || quantity <= 0) {
      toast.error('Pilih produk dan masukkan jumlah yang valid');
      return;
    }

    const existingItem = items.find((item) => item.productId === selectedProduct.id);
    if (existingItem) {
      setItems(
        items.map((item) =>
          item.productId === selectedProduct.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        ),
      );
    } else {
      setItems([...items, { productId: selectedProduct.id, quantity, product: selectedProduct }]);
    }

    setSelectedProduct(null);
    setQuantity(1);
    setProductSearch('');
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter((item) => item.productId !== productId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fromBranchId || !formData.toBranchId) {
      toast.error('Pilih cabang asal dan tujuan');
      return;
    }

    if (formData.fromBranchId === formData.toBranchId) {
      toast.error('Cabang asal dan tujuan tidak boleh sama');
      return;
    }

    if (items.length === 0) {
      toast.error('Tambahkan minimal satu produk');
      return;
    }

    mutation.mutate({
      fromBranchId: formData.fromBranchId,
      toBranchId: formData.toBranchId,
      transferType: 'regular', // Default, bisa ditambahkan selector nanti
      items: items.map((item) => ({
        productId: item.productId,
        quantityRequested: item.quantity,
        notes: item.product?.notes,
      })),
      notes: formData.notes,
    });
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Transfer Stok" subtitle="Transfer stok antar cabang" />

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Branch Selection */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary-600" />
            Informasi Transfer
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cabang Asal <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.fromBranchId}
                onChange={(e) => setFormData({ ...formData, fromBranchId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Pilih Cabang Asal</option>
                {branches?.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cabang Tujuan <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.toBranchId}
                onChange={(e) => setFormData({ ...formData, toBranchId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Pilih Cabang Tujuan</option>
                {branches
                  ?.filter((branch: any) => branch.id !== formData.fromBranchId)
                  .map((branch: any) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Tambahkan catatan untuk transfer ini..."
            />
          </div>
        </div>

        {/* Product Selection */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Tambah Produk
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Cari Produk</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari produk (nama atau SKU)..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              {productSearch.length > 2 && productsData?.data && (
                <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto z-10">
                  {productsData.data.map((product: any) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        setSelectedProduct({ id: product.id, name: product.name, sku: product.sku });
                        setProductSearch('');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                      {formData.fromBranchId && (
                        <div className="text-xs text-primary-600 mt-1">
                          Stok tersedia: {productStockData?.stocks?.find((s: any) => s.branchId === formData.fromBranchId)?.quantityAvailable || 0} unit
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && formData.fromBranchId && (
                <div className="mt-2 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <div className="text-sm font-medium text-gray-900">{selectedProduct.name}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Stok tersedia di {branches?.find((b: any) => b.id === formData.fromBranchId)?.name || 'cabang ini'}:{' '}
                    <span className="font-semibold text-primary-700">
                      {productStockData?.stocks?.find((s: any) => s.branchId === formData.fromBranchId)?.quantityAvailable || 0} unit
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah ke Daftar</span>
          </button>
        </div>

        {/* Items List */}
        {items.length > 0 && (
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Daftar Produk</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Produk</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Jumlah</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.productId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {item.product?.name || 'Loading...'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-500">{item.product?.sku || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900">{item.quantity}</div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.productId)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/inventory/transfer')}
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4 inline mr-2" />
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || items.length === 0}
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
                <span>Buat Transfer</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

