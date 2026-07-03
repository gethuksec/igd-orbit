import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, X, Loader2, ArrowLeft, Package, DollarSign, FileText, Tag } from 'lucide-react';
import { productsService } from '../../services/products.service';
import { api } from '../../services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';

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
  const [printedNameEdited, setPrintedNameEdited] = useState(false);
  const [userTypedName, setUserTypedName] = useState('');
  const autoFormatLocked = useRef(false);

  // Build formatted name: Kategori - UserName - Warna - Brand
  const formatProductName = (catId: string, title: string, clr: string, brdId: string) => {
    const catName = Array.isArray(categories)
      ? categories.find((c: any) => c.id === catId)?.name || ''
      : '';
    const brandName = Array.isArray(brands)
      ? brands.find((b: any) => b.id === brdId)?.name || ''
      : '';
    const parts = [catName, title, clr, brandName].filter(Boolean);
    return parts.join(' - ');
  };

  // Debounced auto-format: waits 500ms after user stops changing category/color/brand
  // Uses userTypedName as the title so typed input is always preserved
  // Locks permanently when user edits name after auto-format has already modified it
  const autoFormatTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoFormatHasModified = useRef(false);
  useEffect(() => {
    if (isEdit || autoFormatLocked.current) return;
    if (!formData.categoryId && !formData.color && !formData.brandId) return;

    if (autoFormatTimer.current) clearTimeout(autoFormatTimer.current);
    autoFormatTimer.current = setTimeout(() => {
      const formatted = formatProductName(formData.categoryId, userTypedName, formData.color, formData.brandId);
      if (formatted && formatted !== formData.name) {
        setFormData((prev) => ({ ...prev, name: formatted }));
        autoFormatHasModified.current = true;
      }
      // If name matches formatted exactly, auto-format has done its job — next user edit locks it
      if (formatted === formData.name) {
        autoFormatHasModified.current = true;
      }
    }, 500);

    return () => { if (autoFormatTimer.current) clearTimeout(autoFormatTimer.current); };
  }, [formData.categoryId, formData.color, formData.brandId, userTypedName]);

  // Auto-update printedName when name changes (unless user has manually edited it)
  useEffect(() => {
    if (!printedNameEdited && formData.name) {
      setFormData((prev) => ({ ...prev, printedName: formData.name }));
    }
  }, [formData.name]);

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
      const existingPrintedName = (product as any).printedName || '';
      setPrintedNameEdited(!!existingPrintedName && existingPrintedName !== product.name);
      setFormData({
        name: product.name || '',
        printedName: existingPrintedName || product.name || '',
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

  // Auto-fill minSellingPrice = Silver price on create
  useEffect(() => {
    if (isEdit) return;
    if (formData.sellingPrice <= 0) return;
    if (!customerTiers || !Array.isArray(customerTiers)) return;

    const silverTier = customerTiers.find((t: any) => t.code === 'SILVER' || t.name?.toLowerCase() === 'silver');
    if (!silverTier) return;

    const silverPrice = formData.memberPricing?.[silverTier.id];
    const autoMinPrice = typeof silverPrice === 'number' ? silverPrice : formData.sellingPrice;

    if (formData.minSellingPrice <= 0 || formData.minSellingPrice !== autoMinPrice) {
      setFormData((prev) => ({ ...prev, minSellingPrice: autoMinPrice }));
    }
  }, [formData.sellingPrice, formData.memberPricing, customerTiers, isEdit]);

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
      <Card className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl shadow-lg text-white border-0">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/products')}
                className="text-white/80 hover:bg-white/20"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-4xl font-bold mb-2">
                  {isEdit ? 'Edit Produk' : 'Tambah Produk'}
                </h1>
                <p className="text-primary-100 text-lg">
                  {isEdit ? 'Ubah informasi produk' : 'Tambahkan produk baru ke inventori'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/products')}
              className="bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border-white/20"
            >
              <X className="w-4 h-4 mr-2" />
              Batal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Single Long-Scroll Form */}
      <Card className="shadow-md border border-gray-100 overflow-hidden">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-10">

            {/* ---- Section 1: Informasi Dasar ---- */}
            <div>
              <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Package className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Informasi Dasar</h2>
                  <p className="text-sm text-gray-500">Informasi utama produk</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">
                    Nama Produk <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Lock auto-format if user edits name after it was modified by auto-format
                      if (autoFormatHasModified.current) {
                        autoFormatLocked.current = true;
                      }
                      setUserTypedName(val);
                      setFormData((prev) => ({ ...prev, name: val }));
                    }}
                    required
                    placeholder="Masukkan nama produk"
                    maxLength={250}
                  />
                  <span className="text-xs text-gray-400 mt-1">{formData.name.length}/250</span>
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">SKU</Label>
                  <Input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Auto-generate jika kosong"
                  />
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Barcode</Label>
                  <Input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Kosongkan untuk auto-generate"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Biarkan kosong untuk generate otomatis</p>
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Nama Tercetak</Label>
                  <Input
                    type="text"
                    value={formData.printedName}
                    onChange={(e) => {
                      setPrintedNameEdited(true);
                      setFormData({ ...formData, printedName: e.target.value });
                    }}
                    placeholder="Nama yang tercetak di label/sticker"
                    maxLength={200}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-400">
                      {formData.printedName.length > 100 ? '⚠️ Akan terpotong di nota (max 100)' : ''}
                    </span>
                    <span className={`text-xs ${formData.printedName.length > 100 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                      {formData.printedName.length}/200
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Satuan</Label>
                  <Input
                    type="text"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="pcs, box, kg, dll"
                  />
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Ukuran</Label>
                  <Input
                    type="text"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    placeholder="Contoh: 256GB, 6.2 inch, dll"
                  />
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Warna</Label>
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
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
                  <h2 className="text-lg font-bold text-gray-900">Kategori & Brand</h2>
                  <p className="text-sm text-gray-500">Pengelompokan dan merek produk</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">
                    Kategori <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    {(categories || []).map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Sub Kategori</Label>
                  <Select
                    value={formData.subCategoryId}
                    onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                  >
                    <option value="">Pilih Sub Kategori</option>
                    {categories && Array.isArray(categories) && categories
                      .filter((cat: any) => cat.parentCategoryId === formData.categoryId)
                      .map((cat: any) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </Select>
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Brand</Label>
                  <Select
                    value={formData.brandId}
                    onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                  >
                    <option value="">Pilih Brand</option>
                    {(brands || []).map((brand: any) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Supplier</Label>
                  <Select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  >
                    <option value="">Pilih Supplier</option>
                    {(suppliers || []).map((supplier: any) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </Select>
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
                  <h2 className="text-lg font-bold text-gray-900">Harga & Stok</h2>
                  <p className="text-sm text-gray-500">Informasi harga dan inventori</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="costPrice" className="block text-sm font-bold text-gray-700 mb-2.5">
                    Harga Beli <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="costPrice"
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    required
                    min="0"
                    step="1000"
                  />
                </div>

                <div>
                  <Label htmlFor="sellingPrice" className="block text-sm font-bold text-gray-700 mb-2.5">
                    Harga Jual <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sellingPrice"
                    type="number"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                    required
                    min="0"
                    step="1000"
                  />
                </div>

                <div>
                  <Label htmlFor="minSellingPrice" className="block text-sm font-bold text-gray-700 mb-2.5">Harga Jual Minimum <span className="text-red-500">*</span></Label>
                  <Input
                    id="minSellingPrice"
                    type="number"
                    value={formData.minSellingPrice}
                    onChange={(e) => setFormData({ ...formData, minSellingPrice: parseFloat(e.target.value) || 0 })}
                    required
                    min="0"
                    step="1000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div>
                  <Label htmlFor="lengthCm" className="block text-sm font-bold text-gray-700 mb-2.5">Panjang (cm)</Label>
                  <Input
                    id="lengthCm"
                    type="number"
                    value={formData.lengthCm}
                    onChange={(e) => setFormData({ ...formData, lengthCm: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.1"
                  />
                </div>

                <div>
                  <Label htmlFor="widthCm" className="block text-sm font-bold text-gray-700 mb-2.5">Lebar (cm)</Label>
                  <Input
                    id="widthCm"
                    type="number"
                    value={formData.widthCm}
                    onChange={(e) => setFormData({ ...formData, widthCm: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.1"
                  />
                </div>

                <div>
                  <Label htmlFor="heightCm" className="block text-sm font-bold text-gray-700 mb-2.5">Tinggi (cm)</Label>
                  <Input
                    id="heightCm"
                    type="number"
                    value={formData.heightCm}
                    onChange={(e) => setFormData({ ...formData, heightCm: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <div>
                  <Label htmlFor="weightGrams" className="block text-sm font-bold text-gray-700 mb-2.5">Berat Barang (gram)</Label>
                  <Input
                    id="weightGrams"
                    type="number"
                    value={formData.weightGrams}
                    onChange={(e) => setFormData({ ...formData, weightGrams: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.1"
                  />
                </div>

                <div>
                  <Label htmlFor="packageWeightGrams" className="block text-sm font-bold text-gray-700 mb-2.5">Berat Paket (gram)</Label>
                  <Input
                    id="packageWeightGrams"
                    type="number"
                    value={formData.packageWeightGrams}
                    onChange={(e) => setFormData({ ...formData, packageWeightGrams: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.1"
                  />
                </div>

                <div>
                  <Label htmlFor="minStock" className="block text-sm font-bold text-gray-700 mb-2.5">Min Stock</Label>
                  <Input
                    id="minStock"
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
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
                  <h2 className="text-lg font-bold text-gray-900">Deskripsi & Status</h2>
                  <p className="text-sm text-gray-500">Informasi tambahan dan pengaturan produk</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <Label className="block text-sm font-bold text-gray-700 mb-2.5">Deskripsi</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                    placeholder="Masukkan deskripsi produk"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Checkbox
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                    <div>
                      <Label htmlFor="isActive" className="font-bold text-gray-700 cursor-pointer">
                        Produk Aktif
                      </Label>
                      <p className="text-xs text-gray-500">Produk tersedia untuk dijual</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Checkbox
                      id="isService"
                      checked={formData.isService}
                      onCheckedChange={(checked) => setFormData({ ...formData, isService: checked })}
                    />
                    <div>
                      <Label htmlFor="isService" className="font-bold text-gray-700 cursor-pointer">
                        Produk Jasa
                      </Label>
                      <p className="text-xs text-gray-500">Bukan barang fisik</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Checkbox
                      id="trackSerial"
                      checked={formData.trackSerial}
                      onCheckedChange={(checked) => setFormData({ ...formData, trackSerial: checked })}
                    />
                    <div>
                      <Label htmlFor="trackSerial" className="font-bold text-gray-700 cursor-pointer">
                        Track Serial Number
                      </Label>
                      <p className="text-xs text-gray-500">SN(1)/Bahan(2) = 1</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Checkbox
                      id="trackBatch"
                      checked={formData.trackBatch}
                      onCheckedChange={(checked) => setFormData({ ...formData, trackBatch: checked })}
                    />
                    <div>
                      <Label htmlFor="trackBatch" className="font-bold text-gray-700 cursor-pointer">
                        Menggunakan No Batch
                      </Label>
                      <p className="text-xs text-gray-500">Track by batch number</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <Checkbox
                      id="trackExpiry"
                      checked={formData.trackExpiry}
                      onCheckedChange={(checked) => setFormData({ ...formData, trackExpiry: checked })}
                    />
                    <div>
                      <Label htmlFor="trackExpiry" className="font-bold text-gray-700 cursor-pointer">
                        Menggunakan Tgl Kadaluarsa
                      </Label>
                      <p className="text-xs text-gray-500">Track expiry date</p>
                    </div>
                  </div>

                  {formData.trackExpiry && (
                    <div>
                      <Label className="block text-sm font-bold text-gray-700 mb-2.5">Batas Retur Kadaluarsa (hari)</Label>
                      <Input
                        type="number"
                        value={formData.expiryReturnLimitDays}
                        onChange={(e) => setFormData({ ...formData, expiryReturnLimitDays: parseInt(e.target.value) || 0 })}
                        min="0"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/products')}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={mutation.isPending}
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
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
