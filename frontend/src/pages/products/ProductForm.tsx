import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Loader2, ArrowLeft, Package, DollarSign, FileText, Tag } from 'lucide-react';
import { productsService } from '../../services/products.service';
import { api } from '../../services/api';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const [activeTab, setActiveTab] = useState('basic');

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
    isService: false,
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
        isActive: (product as any).isActive !== undefined ? (product as any).isActive : (product.status === 'ACTIVE' || product.status === 'active'),
        isService: (product as any).isService || false,
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

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {[
              { id: 'basic', label: 'Informasi Dasar', icon: Package },
              { id: 'category', label: 'Kategori & Brand', icon: Tag },
              { id: 'pricing', label: 'Harga & Stok', icon: DollarSign },
              { id: 'description', label: 'Deskripsi & Status', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                      : 'text-gray-600 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          {/* Tab: Basic Information */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
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
              </div>
            </div>
          )}

          {/* Tab: Category & Brand */}
          {activeTab === 'category' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          )}

          {/* Tab: Pricing & Stock */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
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
          )}

          {/* Tab: Description & Status */}
          {activeTab === 'description' && (
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
          )}

          {/* Form Actions - Enhanced */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-t border-gray-200 mt-6">
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
    </div>
  );
}
