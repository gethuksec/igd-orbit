import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Loader2, ArrowLeft, Package, DollarSign, FileText, Tag, Users } from 'lucide-react';
import { productsService } from '../../services/products.service';
import { api } from '../../services/api';

function generateBarcode(): string {
  const now = new Date();
  const yymmdd = now.getFullYear().toString().slice(2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BRC-${yymmdd}-${rand}`;
}

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    printedName: '',
    sku: '',
    barcode: '',
    categoryId: '',
    subCategoryId: '',
    brandId: '',
    supplierId: '',
    costPrice: 0,
    sellingPrice: 0,
    minSellingPrice: 0,
    unit: 'pcs',
    size: '',
    color: '',
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    weightGrams: 0,
    packageWeightGrams: 0,
    minStock: 0,
    description: '',
    isActive: true,
    isService: false,
    trackSerial: false,
    trackBatch: false,
    trackExpiry: false,
    expiryReturnLimitDays: 0,
    memberPricing: {} as Record<string, number>,
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

  const { data: customerTiers } = useQuery({
    queryKey: ['customer-tiers'],
    queryFn: async () => {
      const res = await api.get('/customers/tiers');
      return res.data.data || res.data || [];
    },
  });

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await api.get('/brands');
      return res.data.data || res.data;
    },
  });

  // Fetch suppliers (customers with customerType='wholesale')
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      try {
        const res = await api.get('/customers', {
          params: { 'filter[customerType]': 'wholesale', limit: 1000 },
        });
        return res.data.data || res.data || [];
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        return [];
      }
    },
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        printedName: (product as any).printedName || product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        subCategoryId: (product as any).subCategoryId || '',
        brandId: product.brandId || '',
        supplierId: (product as any).supplierId || '',
        costPrice: product.costPrice || 0,
        sellingPrice: product.sellingPrice || 0,
        minSellingPrice: (product as any).minSellingPrice || 0,
        unit: (product as any).unit || product.unit || 'pcs',
        size: (product as any).size || '',
        color: (product as any).color || '',
        lengthCm: (product as any).lengthCm || 0,
        widthCm: (product as any).widthCm || 0,
        heightCm: (product as any).heightCm || 0,
        weightGrams: (product as any).weightGrams || 0,
        packageWeightGrams: (product as any).packageWeightGrams || 0,
        minStock: product.minStock || 0,
        description: (product as any).description || '',
        isActive: (product as any).isActive !== undefined ? (product as any).isActive : (product.status === 'ACTIVE' || product.status === 'active'),
        isService: (product as any).isService || false,
        trackSerial: (product as any).trackSerial || product.trackSerial || false,
        trackBatch: (product as any).trackBatch || product.trackBatch || false,
        trackExpiry: (product as any).trackExpiry || false,
        expiryReturnLimitDays: (product as any).expiryReturnLimitDays || 0,
        memberPricing: (product as any).memberPricing || {},
      });
    }
  }, [product]);

  // Auto-fill tier prices when category or sellingPrice changes
  useEffect(() => {
    if (formData.categoryId && categories && formData.sellingPrice > 0) {
      const category = Array.isArray(categories)
        ? categories.find((c: any) => c.id === formData.categoryId)
        : null;
      if (category && (category as any).tierMargins && customerTiers && Array.isArray(customerTiers)) {
        const tierMargins = (category as any).tierMargins || {};
        const newMemberPricing = { ...formData.memberPricing };
        let changed = false;
        for (const tier of customerTiers) {
          const margin = tierMargins[tier.id];
          if (margin !== undefined && margin > 0) {
            const tierPrice = formData.sellingPrice + margin;
            // Only set if not manually edited (not already set or zero)
            if (!newMemberPricing[tier.id] || newMemberPricing[tier.id] === 0) {
              newMemberPricing[tier.id] = tierPrice;
              changed = true;
            }
          }
        }
        if (changed) {
          setFormData((prev) => ({ ...prev, memberPricing: newMemberPricing }));
        }
      }
    }
  }, [formData.categoryId, formData.sellingPrice, categories, customerTiers]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      // Clean up memberPricing before sending
      const submitData = { ...data };
      if (submitData.memberPricing && Object.keys(submitData.memberPricing).length === 0) {
        submitData.memberPricing = null;
      }
      return isEdit
        ? productsService.update(id!, submitData)
        : productsService.create(submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/products');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-generate barcode if empty
    const barcode = formData.barcode || generateBarcode();
    // Convert empty strings to undefined for optional UUID fields
    const submitData = {
      ...formData,
      barcode,
      subCategoryId: formData.subCategoryId || undefined,
      brandId: formData.brandId || undefined,
      supplierId: formData.supplierId || undefined,
    };
    mutation.mutate(submitData);
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
      {/* Page Header */}
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

      {/* Single Long-Scroll Form */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden p-8">
        <form onSubmit={handleSubmit} className="space-y-10">

          {/* ---- Section 1: Informasi Dasar ---- */}
          <div>
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
              <div className="p-2 bg-primary-50 rounded-lg">
                <Package className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Informasi Dasar</h3>
                <p className="text-sm text-gray-500">Informasi utama produk</p>
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
                  placeholder="Kosongkan untuk auto-generate"
                />
                <p className="text-xs text-gray-400 mt-1.5">Biarkan kosong untuk generate otomatis</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Nama Tercetak</label>
                <input
                  type="text"
                  value={formData.printedName}
                  onChange={(e) => setFormData({ ...formData, printedName: e.target.value })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  placeholder="Nama yang tercetak di label/sticker"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Satuan</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  placeholder="pcs, box, kg, dll"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Ukuran</label>
                <input
                  type="text"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  placeholder="Contoh: 256GB, 6.2 inch, dll"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Warna</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  placeholder="Contoh: Black, Blue, dll"
                />
              </div>
            </div>
          </div>

          {/* ---- Section 2: Kategori & Brand ---- */}
          <div>
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
              <div className="p-2 bg-primary-50 rounded-lg">
                <Tag className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Kategori & Brand</h3>
                <p className="text-sm text-gray-500">Pengelompokan dan merek produk</p>
              </div>
            </div>
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
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Sub Kategori</label>
                <select
                  value={formData.subCategoryId}
                  onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                >
                  <option value="">Pilih Sub Kategori</option>
                  {categories && Array.isArray(categories) && categories
                    .filter((cat: any) => cat.parentCategoryId === formData.categoryId)
                    .map((cat: any) => (
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

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Supplier</label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
                >
                  <option value="">Pilih Supplier</option>
                  {(suppliers || []).map((supplier: any) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ---- Section 3: Harga & Stok ---- */}
          <div>
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
              <div className="p-2 bg-primary-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Harga & Stok</h3>
                <p className="text-sm text-gray-500">Informasi harga dan inventori</p>
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
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Harga Jual Minimum</label>
                <input
                  type="number"
                  value={formData.minSellingPrice}
                  onChange={(e) => setFormData({ ...formData, minSellingPrice: parseFloat(e.target.value) || 0 })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  min="0"
                  step="1000"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Panjang (cm)</label>
                <input
                  type="number"
                  value={formData.lengthCm}
                  onChange={(e) => setFormData({ ...formData, lengthCm: parseFloat(e.target.value) || 0 })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  min="0"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Lebar (cm)</label>
                <input
                  type="number"
                  value={formData.widthCm}
                  onChange={(e) => setFormData({ ...formData, widthCm: parseFloat(e.target.value) || 0 })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  min="0"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Tinggi (cm)</label>
                <input
                  type="number"
                  value={formData.heightCm}
                  onChange={(e) => setFormData({ ...formData, heightCm: parseFloat(e.target.value) || 0 })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Berat Barang (gram)</label>
                <input
                  type="number"
                  value={formData.weightGrams}
                  onChange={(e) => setFormData({ ...formData, weightGrams: parseFloat(e.target.value) || 0 })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  min="0"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2.5">Berat Paket (gram)</label>
                <input
                  type="number"
                  value={formData.packageWeightGrams}
                  onChange={(e) => setFormData({ ...formData, packageWeightGrams: parseFloat(e.target.value) || 0 })}
                  className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                  min="0"
                  step="0.1"
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

          {/* ---- Section 4: Deskripsi & Status ---- */}
          <div>
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
              <div className="p-2 bg-primary-50 rounded-lg">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Deskripsi & Status</h3>
                <p className="text-sm text-gray-500">Informasi tambahan dan pengaturan produk</p>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <label htmlFor="isActive" className="text-sm font-bold text-gray-700 cursor-pointer">
                      Produk Aktif
                    </label>
                    <p className="text-xs text-gray-500">Produk tersedia untuk dijual</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    id="isService"
                    checked={formData.isService}
                    onChange={(e) => setFormData({ ...formData, isService: e.target.checked })}
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <label htmlFor="isService" className="text-sm font-bold text-gray-700 cursor-pointer">
                      Produk Jasa
                    </label>
                    <p className="text-xs text-gray-500">Bukan barang fisik</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    id="trackSerial"
                    checked={formData.trackSerial}
                    onChange={(e) => setFormData({ ...formData, trackSerial: e.target.checked })}
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <label htmlFor="trackSerial" className="text-sm font-bold text-gray-700 cursor-pointer">
                      Track Serial Number
                    </label>
                    <p className="text-xs text-gray-500">SN(1)/Bahan(2) = 1</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    id="trackBatch"
                    checked={formData.trackBatch}
                    onChange={(e) => setFormData({ ...formData, trackBatch: e.target.checked })}
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <label htmlFor="trackBatch" className="text-sm font-bold text-gray-700 cursor-pointer">
                      Menggunakan No Batch
                    </label>
                    <p className="text-xs text-gray-500">Track by batch number</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <input
                    type="checkbox"
                    id="trackExpiry"
                    checked={formData.trackExpiry}
                    onChange={(e) => setFormData({ ...formData, trackExpiry: e.target.checked })}
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <label htmlFor="trackExpiry" className="text-sm font-bold text-gray-700 cursor-pointer">
                      Menggunakan Tgl Kadaluarsa
                    </label>
                    <p className="text-xs text-gray-500">Track expiry date</p>
                  </div>
                </div>

                {formData.trackExpiry && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2.5">Batas Retur Kadaluarsa (hari)</label>
                    <input
                      type="number"
                      value={formData.expiryReturnLimitDays}
                      onChange={(e) => setFormData({ ...formData, expiryReturnLimitDays: parseInt(e.target.value) || 0 })}
                      className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
                      min="0"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>{isEdit ? 'Update Produk' : 'Simpan Produk'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
