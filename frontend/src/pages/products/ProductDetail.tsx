import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Edit,
  ArrowLeft,
  Package,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Warehouse,
  History,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Settings,
} from 'lucide-react';
import { productsService } from '../../services/products.service';
import { customerTiersService } from '../../services/customer-tiers.service';
import { api } from '../../services/api';
import { Button } from '@/components/ui/button';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsService.getById(id!),
    enabled: !!id,
  });

  // Fetch activity - show more items, scrollable container
  const { data: activityData, isLoading: loadingActivity } = useQuery({
    queryKey: ['product-activity', id],
    queryFn: async () => {
      const response = await api.get(`/products/${id}/activity`, {
        params: {
          page: 1,
          limit: 50,
        },
      });
      return response.data;
    },
    enabled: !!id,
    staleTime: 30000,
  });

  // Fetch sales statistics (total sold)
  const { data: salesStats } = useQuery({
    queryKey: ['product-sales-stats', id],
    queryFn: async () => {
      const response = await api.get(`/products/${id}/sales-stats`);
      return response.data;
    },
    enabled: !!id,
    staleTime: 60000,
  });

  // IGDERP-195 (QA R2 23 Sep): master must show per-tier member values, not
  // just reguler+minimum — same source as the stock list (global tiers +
  // product.memberPricing overrides)
  const { data: tiersData } = useQuery({
    queryKey: ['customer-tiers-active'],
    queryFn: () => customerTiersService.getAll({ limit: 50 }),
    staleTime: 300000,
  });
  const activeTiers = (tiersData?.data || []).filter(
    (t: any) => t.isActive !== false && Number(t.discountPercentage) > 0,
  );
  const tierValue = (t: any) => {
    const stored = (product as any)?.memberPricing?.[t.id];
    const selling = Number(product?.sellingPrice) || 0;
    if (typeof stored === 'number' && stored > 0) return stored;
    if (stored && typeof stored.price === 'number' && stored.price > 0) return stored.price;
    if (stored && typeof stored.discount === 'number')
      return Math.round(selling * (1 - Number(stored.discount) / 100));
    return Math.round(selling * (1 - Number(t.discountPercentage) / 100));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 text-lg">Produk tidak ditemukan</p>
        <button
          onClick={() => navigate('/products')}
          className="mt-4 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
        >
          Kembali ke daftar produk
        </button>
      </div>
    );
  }

  // Relations (unit/size/color) come back as objects {id, name} from the API;
  // render their name safely whether the backend sends a string or an object.
  const relationName = (relation: { name?: string } | string | null | undefined) => {
    if (typeof relation === 'string') return relation;
    return relation?.name || '';
  };
  const unitName = relationName((product as any).unit) || 'pcs';
  const sizeName = relationName((product as any).size);
  const colorName = relationName((product as any).color);

  const margin = product.sellingPrice - product.costPrice;
  const marginPercent = ((margin / product.costPrice) * 100).toFixed(1);
  const totalStock = (product as any).totalStock || 0;
  const stockSummary = (product as any).stockSummary;
  const minStock = (product as any).minStock || 0;
  const isLowStock = totalStock < minStock;

  return (
    <div className="w-full space-y-4">
      {/* Compact Header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/products')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{product.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{product.sku}</span>
                  {product.barcode && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded font-mono">
                      {product.barcode}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      (product as any).isActive
                        ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {(product as any).isActive ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Aktif
                      </>
                    ) : (
                      'Tidak Aktif'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Link to={`/products/${id}/edit`}>
            <Button className="flex items-center gap-2">
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Produk */}
        <div className="space-y-4">
          {/* Product Information & Pricing - Combined */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              Informasi Produk
            </h2>
            <div className="space-y-4">
              {/* Scan-line Info Fields */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                <div className="flex items-center justify-between py-2.5 first:pt-0">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">SKU</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">{product.sku}</span>
                </div>
                {product.barcode && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Barcode</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">{product.barcode}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Satuan</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{unitName}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Jasa</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{(product as any).isService ? 'Ya' : 'Tidak'}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Kategori</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{product.category?.name || product.categoryId}</span>
                </div>
                {(product as any).subCategory && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Sub Kategori</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{(product as any).subCategory?.name || ''}</span>
                  </div>
                )}
                {product.brand && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Brand</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{product.brand.name}</span>
                  </div>
                )}
                {(product as any).supplier && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Supplier</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{(product as any).supplier?.name || ''}</span>
                  </div>
                )}
              </div>

              {/* Physical Attributes */}
              {(sizeName || colorName || (product as any).lengthCm || (product as any).widthCm || (product as any).heightCm || (product as any).weightGrams || (product as any).packageWeightGrams) && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Atribut Fisik</p>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sizeName && (
                      <div className="flex items-center justify-between py-2.5 first:pt-0">
                        <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Ukuran</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{sizeName}</span>
                      </div>
                    )}
                    {colorName && (
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Warna</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{colorName}</span>
                      </div>
                    )}
                    {((product as any).lengthCm || (product as any).widthCm || (product as any).heightCm) && (
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Dimensi (cm)</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                          {(product as any).lengthCm || 0} × {(product as any).widthCm || 0} × {(product as any).heightCm || 0}
                        </span>
                      </div>
                    )}
                    {((product as any).weightGrams || (product as any).packageWeightGrams) && (
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Berat</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                          {(product as any).weightGrams ? `${(product as any).weightGrams}g` : '-'}
                          {(product as any).packageWeightGrams && ` / ${(product as any).packageWeightGrams}g (paket)`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tracking Settings */}
              {((product as any).trackSerial || (product as any).trackBatch || (product as any).trackExpiry) && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Pengaturan Tracking</p>
                  <div className="flex flex-wrap gap-2">
                    {(product as any).trackSerial && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded-md text-xs font-semibold">
                        Track Serial Number
                      </span>
                    )}
                    {(product as any).trackBatch && (
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 rounded-md text-xs font-semibold">
                        Track Batch Number
                      </span>
                    )}
                    {(product as any).trackExpiry && (
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200 rounded-md text-xs font-semibold">
                        Track Expiry Date
                        {(product as any).expiryReturnLimitDays && ` (${(product as any).expiryReturnLimitDays} hari)`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              {(product as any).printedName && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nama Tercetak</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{(product as any).printedName}</p>
                </div>
              )}
              {(product as any).description && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Deskripsi</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{(product as any).description}</p>
                </div>
              )}
            </div>

            {/* Pricing - Enhanced */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Informasi Harga</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="pb-1.5 border-b border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">HARGA BELI</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 font-mono">{formatCurrency(product.costPrice)}</p>
                </div>
                <div className="p-2.5 bg-primary-50 dark:bg-primary-950 border-b border-primary-200 dark:border-primary-800">
                  <p className="text-xs text-primary-600 dark:text-primary-400 mb-1">HARGA JUAL</p>
                  <p className="text-lg font-bold text-primary-600 dark:text-primary-400 font-mono">{formatCurrency(product.sellingPrice)}</p>
                </div>
                {(product as any).minSellingPrice && (
                  <div className="p-2.5 bg-yellow-50 dark:bg-yellow-950 border-b border-yellow-200 dark:border-yellow-800">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">HARGA JUAL MINIMUM</p>
                    <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400 font-mono">{formatCurrency((product as any).minSellingPrice)}</p>
                  </div>
                )}
                <div className="p-2.5 bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1">MARGIN</p>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400 font-mono">{formatCurrency(margin)}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300 font-mono">{marginPercent}%</p>
                  </div>
                </div>
              </div>
              {/* IGDERP-195 (QA R2 23 Sep): per-tier member values on master */}
              {activeTiers.length > 0 && (
                <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-testid="tier-pricing-table">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-2 bg-gray-50 dark:bg-gray-950">
                    HARGA MEMBER PER TIER
                  </p>
                  {activeTiers.map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 text-sm"
                    >
                      <span className="text-gray-600 dark:text-gray-400">
                        {t.name}
                        <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500">
                          ({Number(t.discountPercentage)}%)
                        </span>
                      </span>
                      <span className="font-bold text-red-600 dark:text-red-400 font-mono" data-testid={`tier-price-${t.id}`}>
                        {formatCurrency(tierValue(t))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sales Statistics */}
            {salesStats && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">Statistik Penjualan & Penggunaan</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="p-2 border-l-4 border-blue-500 bg-blue-50/30 dark:bg-blue-950/30 rounded-r-lg">
                      <p className="text-xs text-blue-600 dark:text-blue-400 mb-0.5 font-medium uppercase tracking-wider">Total Terjual</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {salesStats.totalSold?.toLocaleString('id-ID') || 0}
                      </p>
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                        {salesStats.totalReturned > 0 && (
                          <span className="text-red-600 dark:text-red-400">({salesStats.totalReturned} dikembalikan)</span>
                        )}
                        {!salesStats.totalReturned && 'Penjualan'}
                      </p>
                    </div>
                    <div className="p-2 border-l-4 border-purple-500 bg-purple-50/30 dark:bg-purple-950/30 rounded-r-lg">
                      <p className="text-xs text-purple-600 dark:text-purple-400 mb-0.5 font-medium uppercase tracking-wider">Total Revenue</p>
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">
                        {formatCurrency(salesStats.totalRevenue || 0)}
                      </p>
                      <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">
                        {salesStats.totalReturnedRevenue > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            ({formatCurrency(salesStats.totalReturnedRevenue)} dikembalikan)
                          </span>
                        )}
                        {!salesStats.totalReturnedRevenue && 'Penjualan'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2 border-l-4 border-green-500 bg-green-50/30 dark:bg-green-950/30 rounded-r-lg">
                      <p className="text-xs text-green-600 dark:text-green-400 mb-0.5 font-medium uppercase tracking-wider">Total Terjual</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {salesStats.totalUsedInService?.toLocaleString('id-ID') || 0}
                      </p>
                      <p className="text-xs text-green-500 dark:text-green-400 mt-0.5">Service</p>
                    </div>
                    <div className="p-2 border-l-4 border-orange-500 bg-orange-50/30 dark:bg-orange-950/30 rounded-r-lg">
                      <p className="text-xs text-orange-600 dark:text-orange-400 mb-0.5 font-medium uppercase tracking-wider">Total Revenue</p>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-400 font-mono">
                        {formatCurrency(salesStats.totalServiceRevenue || 0)}
                      </p>
                      <p className="text-xs text-orange-500 dark:text-orange-400 mt-0.5">Service</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Stok, Stok Per Cabang, Riwayat Aktivitas */}
        <div className="space-y-4">
          {/* Stock Card - Enhanced with Branch Details */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              Stok
            </h2>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Stok Tersedia</p>
                <p className={`text-2xl font-bold ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {totalStock}
                </p>
                {stockSummary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Tersedia: {stockSummary.totalAvailable || 0} | Reserved: {stockSummary.totalReserved || 0}
                  </p>
                )}
              </div>
              {minStock > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Min Stock</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{minStock}</p>
                </div>
              )}
              {isLowStock && (
                <div className="p-2 bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg mt-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-red-800 dark:text-red-200">Stok Rendah</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Perlu restock segera</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stock Per Branch - Horizontal Carousel */}
          {stockSummary?.branches?.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Stok Per Cabang
                </h2>
                {stockSummary.branches.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const el = document.getElementById('branch-carousel');
                        if (el) el.scrollBy({ left: -280, behavior: 'smooth' });
                      }}
                      className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        const el = document.getElementById('branch-carousel');
                        if (el) el.scrollBy({ left: 280, behavior: 'smooth' });
                      }}
                      className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </button>
                  </div>
                )}
              </div>
              <div
                id="branch-carousel"
                className="flex overflow-x-auto gap-3 snap-x snap-mandatory scrollbar-hide pb-1"
              >
                {stockSummary.branches.map((branch: any) => {
                  const branchStock = branch.available - branch.reserved;
                  const branchIsLow = branchStock < (branch.minStock || 0);
                  return (
                    <div key={branch.branchId} className="flex-shrink-0 w-56 snap-start bg-gray-50 dark:bg-gray-950 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate">{branch.branchName}</p>
                      <p className={`text-2xl font-bold mb-2 ${branchIsLow ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {branchStock}
                      </p>
                      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                          <span>Tersedia</span>
                          <span className="font-medium">{branch.available}</span>
                        </div>
                        {branch.reserved > 0 && (
                          <div className="flex justify-between">
                            <span>Reserved</span>
                            <span className="font-medium text-yellow-600 dark:text-yellow-400">{branch.reserved}</span>
                          </div>
                        )}
                        {branch.damaged > 0 && (
                          <div className="flex justify-between">
                            <span>Rusak</span>
                            <span className="font-medium text-red-600 dark:text-red-400">{branch.damaged}</span>
                          </div>
                        )}
                      </div>
                      {branch.minStock && branchStock < branch.minStock && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Di bawah min ({branch.minStock})
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity Log - Scrollable */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <History className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Riwayat Aktivitas
              </h2>
              {activityData?.data && activityData.data.length > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{activityData.data.length} aktivitas</span>
              )}
            </div>
            {loadingActivity ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-500 dark:text-primary-400 animate-spin" />
              </div>
            ) : activityData?.data && activityData.data.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
                {activityData.data.map((activity: any) => {
                  const getActivityIcon = () => {
                    switch (activity.type) {
                      case 'STOCK_IN':
                        return <ArrowUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
                      case 'STOCK_OUT':
                        return <ArrowDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
                      case 'STOCK_TRANSFER':
                        return <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
                      case 'STOCK_ADJUSTMENT':
                        return <Settings className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
                      case 'SALES':
                        return <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
                      case 'SALES_RETURN':
                        return <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400 rotate-180" />;
                      case 'SERVICE_USAGE':
                        return <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
                      default:
                        return <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
                    }
                  };

                  const getActivityColor = () => {
                    switch (activity.type) {
                      case 'STOCK_IN':
                        return 'border-l-4 border-green-500 bg-green-50/30 dark:bg-green-950/30';
                      case 'STOCK_OUT':
                        return 'border-l-4 border-red-500 bg-red-50/30 dark:bg-red-950/30';
                      case 'STOCK_TRANSFER':
                        return 'border-l-4 border-blue-500 bg-blue-50/30 dark:bg-blue-950/30';
                      case 'STOCK_ADJUSTMENT':
                        return 'border-l-4 border-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/30';
                      case 'SALES':
                        return 'border-l-4 border-purple-500 bg-purple-50/30 dark:bg-purple-950/30';
                      case 'SALES_RETURN':
                        return 'border-l-4 border-red-500 bg-red-50/30 dark:bg-red-950/30';
                      case 'SERVICE_USAGE':
                      case 'SERVICE_USAGE_PENDING':
                        return 'border-l-4 border-orange-500 bg-orange-50/30 dark:bg-orange-950/30';
                      default:
                        return 'border-l-4 border-gray-400 bg-gray-50/30 dark:bg-gray-950/30';
                    }
                  };

                  return (
                    <div
                      key={activity.id}
                      className={`p-2 rounded-r-lg ${getActivityColor()}`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <div className="mt-0.5 flex-shrink-0">{getActivityIcon()}</div>
                        <div className="flex-1 min-w-0">
                          {activity.referenceId ? (
                            activity.referenceType === 'SALES_TRANSACTION' ? (
                              <Link
                                to={`/sales/transactions/${activity.referenceId}`}
                                className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                              >
                                {activity.description}
                              </Link>
                            ) : activity.referenceType === 'SERVICE_ORDER' ? (
                              <Link
                                to={`/service-orders/${activity.referenceId}`}
                                className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-orange-600 dark:hover:text-orange-400 hover:underline"
                              >
                                {activity.description}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{activity.description}</p>
                            )
                          ) : (
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{activity.description}</p>
                          )}
                          {activity.branch && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                              {activity.branch.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          {activity.quantityBefore !== undefined && activity.quantityAfter !== undefined ? (
                            <>
                              {activity.quantityBefore} → <span className="font-semibold">{activity.quantityAfter}</span>
                            </>
                          ) : activity.quantityChange ? (
                            <span className={activity.quantityChange > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {activity.quantityChange > 0 ? '+' : ''}{activity.quantityChange} unit
                            </span>
                          ) : null}
                        </span>
                        <span>
                          {new Date(activity.createdAt).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {activity.referenceId && activity.referenceType === 'SALES_TRANSACTION' && (
                        <Link
                          to={`/sales/transactions/${activity.referenceId}`}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                        >
                          Lihat transaksi →
                        </Link>
                      )}
                      {activity.referenceId && activity.referenceType === 'SERVICE_ORDER' && (
                        <Link
                          to={`/service-orders/${activity.referenceId}`}
                          className="text-xs text-orange-600 dark:text-orange-400 hover:underline mt-1 inline-block"
                        >
                          Lihat service order →
                        </Link>
                      )}
                      {activity.notes && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1" title={activity.notes}>
                          {activity.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Belum ada aktivitas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
