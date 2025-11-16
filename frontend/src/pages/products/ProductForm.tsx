import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Loader2, ArrowLeft, Package, DollarSign, FileText } from 'lucide-react';
import { productsService } from '../../services/products.service';
import { api } from '../../services/api';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    brandId: '',
    costPrice: 0,
    sellingPrice: 0,
    minStock: 0,
    description: '',
    isActive: true,
  });

  const { data: product, isLoading: loadingProduct } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsService.getById(id!),
    enabled: !!id,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories');
      return res.data.data || res.data;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await api.get('/brands');
      return res.data.data || res.data;
    },
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        brandId: product.brandId || '',
        costPrice: product.costPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        minStock: product.minStock || 0,
        description: (product as any).description || '',
        isActive: product.status === 'ACTIVE' || product.status === 'active',
      });
    }
  }, [product]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? productsService.update(id!, data) : productsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Page Header - Enhanced */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/products')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {isEdit ? 'Edit Produk' : 'Tambah Produk'}
              </h1>
              <p className="text-primary-100 text-lg">
                {isEdit ? 'Ubah informasi produk' : 'Tambahkan produk baru ke inventori'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all border border-white/20 font-medium"
          >
            <X className="w-4 h-4" />
            <span>Batal</span>
          </button>
        </div>
      </div>

      {/* Form Card - Enhanced */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        {/* Basic Information Section */}
        <div className="p-8 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-md">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Informasi Dasar</h2>
              <p className="text-sm text-gray-600 mt-1">Data utama produk</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                required
                placeholder="Masukkan nama produk"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="Auto-generate jika kosong"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                placeholder="Masukkan barcode"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                required
              >
                <option value="">Pilih Kategori</option>
                {(categories || []).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">Brand</label>
              <select
                value={formData.brandId}
                onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
              >
                <option value="">Pilih Brand</option>
                {(brands || []).map((brand: any) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="p-8 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Harga & Stok</h2>
              <p className="text-sm text-gray-600 mt-1">Informasi harga dan pengelolaan stok</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">
                Harga Beli <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                required
                min="0"
                step="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">
                Harga Jual <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                required
                min="0"
                step="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">Min Stock</label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="p-8 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Deskripsi & Status</h2>
              <p className="text-sm text-gray-600 mt-1">Informasi tambahan produk</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2.5">Deskripsi</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all resize-none"
                placeholder="Masukkan deskripsi produk"
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-semibold text-gray-900">Produk Aktif</span>
                <p className="text-xs text-gray-600 mt-0.5">Produk akan ditampilkan dan dapat dijual</p>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions - Enhanced */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-t border-gray-200">
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-white hover:border-primary-500 hover:text-primary-600 transition-all font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl font-bold hover:from-primary-700 hover:to-primary-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {mutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{isEdit ? 'Simpan Perubahan' : 'Simpan Produk'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
