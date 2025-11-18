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
import { api } from '../../services/api';
import { useState } from 'react';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activityPage, setActivityPage] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsService.getById(id!),
    enabled: !!id,
  });

  // Lazy load activity - only fetch when needed
  const { data: activityData, isLoading: loadingActivity } = useQuery({
    queryKey: ['product-activity', id, activityPage],
    queryFn: async () => {
      const response = await api.get(`/products/${id}/activity`, {
        params: {
          page: activityPage,
          limit: 3, // Show only 3 latest per page
        },
      });
      return response.data;
    },
    enabled: !!id,
    staleTime: 30000, // Cache for 30 seconds
  });

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
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-600 text-lg">Produk tidak ditemukan</p>
        <button
          onClick={() => navigate('/products')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          Kembali ke daftar produk
        </button>
      </div>
    );
  }

  const margin = product.sellingPrice - product.costPrice;
  const marginPercent = ((margin / product.costPrice) * 100).toFixed(1);
  const totalStock = (product as any).totalStock || 0;
  const stockSummary = (product as any).stockSummary;
  const minStock = (product as any).minStock || 0;
  const isLowStock = totalStock < minStock;

  return (
    <div className="w-full space-y-4">
      {/* Compact Header - Same as CustomerDetail */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/products')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500 font-mono">{product.sku}</span>
                  {product.barcode && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">
                      {product.barcode}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      (product as any).isActive
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
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
            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-all shadow-sm">
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Produk */}
        <div className="space-y-4">
          {/* Product Information & Pricing - Combined */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              Informasi Produk
            </h2>
            <div className="space-y-4">
              {/* Basic Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">SKU</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">{product.sku}</p>
                </div>
                {product.barcode && (
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Barcode</p>
                    <p className="text-sm font-semibold text-gray-900 font-mono">{product.barcode}</p>
                  </div>
                )}
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Satuan</p>
                  <p className="text-sm font-semibold text-gray-900">{(product as any).unit || 'pcs'}</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Jasa</p>
                  <p className="text-sm font-semibold text-gray-900">{(product as any).isService ? 'Ya' : 'Tidak'}</p>
                </div>
              </div>

              {/* Category & Brand */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Kategori</p>
                  <p className="text-sm font-semibold text-gray-900">{product.category?.name || product.categoryId}</p>
                </div>
                {(product as any).subCategory && (
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Sub Kategori</p>
                    <p className="text-sm font-semibold text-gray-900">{(product as any).subCategory?.name || ''}</p>
                  </div>
                )}
                {product.brand && (
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Brand</p>
                    <p className="text-sm font-semibold text-gray-900">{product.brand.name}</p>
                  </div>
                )}
                {(product as any).supplier && (
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Supplier</p>
                    <p className="text-sm font-semibold text-gray-900">{(product as any).supplier?.name || ''}</p>
                  </div>
                )}
              </div>

              {/* Physical Attributes */}
              {((product as any).size || (product as any).color || (product as any).lengthCm || (product as any).weightGrams) && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Atribut Fisik</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(product as any).size && (
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Ukuran</p>
                        <p className="text-sm font-semibold text-gray-900">{(product as any).size}</p>
                      </div>
                    )}
                    {(product as any).color && (
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Warna</p>
                        <p className="text-sm font-semibold text-gray-900">{(product as any).color}</p>
                      </div>
                    )}
                    {((product as any).lengthCm || (product as any).widthCm || (product as any).heightCm) && (
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Dimensi (cm)</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {(product as any).lengthCm || 0} × {(product as any).widthCm || 0} × {(product as any).heightCm || 0}
                        </p>
                      </div>
                    )}
                    {((product as any).weightGrams || (product as any).packageWeightGrams) && (
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Berat</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {(product as any).weightGrams ? `${(product as any).weightGrams}g` : '-'}
                          {(product as any).packageWeightGrams && ` / ${(product as any).packageWeightGrams}g (paket)`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tracking Settings */}
              {((product as any).trackSerial || (product as any).trackBatch || (product as any).trackExpiry) && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Pengaturan Tracking</p>
                  <div className="flex flex-wrap gap-2">
                    {(product as any).trackSerial && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-semibold">
                        Track Serial Number
                      </span>
                    )}
                    {(product as any).trackBatch && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-xs font-semibold">
                        Track Batch Number
                      </span>
                    )}
                    {(product as any).trackExpiry && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-md text-xs font-semibold">
                        Track Expiry Date
                        {(product as any).expiryReturnLimitDays && ` (${(product as any).expiryReturnLimitDays} hari)`}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              {(product as any).printedName && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Nama Tercetak</p>
                  <p className="text-sm font-semibold text-gray-900">{(product as any).printedName}</p>
                </div>
              )}
              {(product as any).description && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Deskripsi</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{(product as any).description}</p>
                </div>
              )}
            </div>

            {/* Pricing - Enhanced */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs font-semibold text-gray-700 mb-2">Informasi Harga</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Harga Beli</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(product.costPrice)}</p>
                </div>
                <div className="p-2.5 bg-primary-50 rounded-lg border border-primary-200">
                  <p className="text-xs text-primary-600 mb-1">Harga Jual</p>
                  <p className="text-sm font-bold text-primary-600">{formatCurrency(product.sellingPrice)}</p>
                </div>
                {(product as any).minSellingPrice && (
                  <div className="p-2.5 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-xs text-yellow-600 mb-1">Harga Jual Minimum</p>
                    <p className="text-sm font-bold text-yellow-600">{formatCurrency((product as any).minSellingPrice)}</p>
                  </div>
                )}
                <div className="p-2.5 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 mb-1">Margin</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(margin)}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <p className="text-xs font-semibold text-green-700">{marginPercent}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stok, Stok Per Cabang, Riwayat Aktivitas */}
        <div className="space-y-4">
          {/* Stock Card - Enhanced with Branch Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              Stok
            </h2>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Stok Tersedia</p>
                <p className={`text-2xl font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                  {totalStock}
                </p>
                {stockSummary && (
                  <p className="text-xs text-gray-500 mt-1">
                    Tersedia: {stockSummary.totalAvailable || 0} | Reserved: {stockSummary.totalReserved || 0}
                  </p>
                )}
              </div>
              {minStock > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-0.5">Min Stock</p>
                  <p className="text-base font-semibold text-gray-900">{minStock}</p>
                </div>
              )}
              {isLowStock && (
                <div className="p-2 bg-red-50 border-l-4 border-red-500 rounded-lg mt-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-red-800">Stok Rendah</p>
                      <p className="text-xs text-red-600 mt-0.5">Perlu restock segera</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stock Per Branch - Compact */}
          {stockSummary && stockSummary.branches && stockSummary.branches.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-primary-600" />
                Stok Per Cabang
              </h2>
              <div className="space-y-2">
                {stockSummary.branches.map((branch: any) => {
                  const branchStock = branch.available - branch.reserved;
                  const branchIsLow = branchStock < (branch.minStock || 0);
                  return (
                    <div key={branch.branchId} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-gray-900">{branch.branchName}</p>
                        <p className={`text-base font-bold ${branchIsLow ? 'text-red-600' : 'text-gray-900'}`}>
                          {branchStock}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span>Tersedia: {branch.available}</span>
                        {branch.reserved > 0 && <span>R: {branch.reserved}</span>}
                        {branch.damaged > 0 && <span className="text-red-600">Rusak: {branch.damaged}</span>}
                      </div>
                      {branch.minStock && branchStock < branch.minStock && (
                        <p className="text-xs text-red-600 mt-1">⚠️ Di bawah min ({branch.minStock})</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Activity Log - Vertical Layout */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-primary-600" />
                Riwayat Aktivitas
              </h2>
              {activityData?.meta && activityData.meta.totalPages > 1 && (
                <span className="text-xs text-gray-500">
                  Halaman {activityData.meta.page} dari {activityData.meta.totalPages}
                </span>
              )}
            </div>
            {loadingActivity ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : activityData?.data && activityData.data.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {activityData.data.map((activity: any) => {
                  const getActivityIcon = () => {
                    switch (activity.type) {
                      case 'STOCK_IN':
                        return <ArrowUp className="w-4 h-4 text-green-600" />;
                      case 'STOCK_OUT':
                        return <ArrowDown className="w-4 h-4 text-red-600" />;
                      case 'STOCK_TRANSFER':
                        return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
                      case 'STOCK_ADJUSTMENT':
                        return <Settings className="w-4 h-4 text-yellow-600" />;
                      default:
                        return <Package className="w-4 h-4 text-gray-600" />;
                    }
                  };

                  const getActivityColor = () => {
                    switch (activity.type) {
                      case 'STOCK_IN':
                        return 'bg-green-50 border-green-200';
                      case 'STOCK_OUT':
                        return 'bg-red-50 border-red-200';
                      case 'STOCK_TRANSFER':
                        return 'bg-blue-50 border-blue-200';
                      case 'STOCK_ADJUSTMENT':
                        return 'bg-yellow-50 border-yellow-200';
                      default:
                        return 'bg-gray-50 border-gray-200';
                    }
                  };

                  return (
                    <div
                      key={activity.id}
                      className={`p-2.5 rounded-lg border ${getActivityColor()}`}
                    >
                      <div className="flex items-start gap-2 mb-1.5">
                        <div className="mt-0.5 flex-shrink-0">{getActivityIcon()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{activity.description}</p>
                          {activity.branch && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              {activity.branch.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>
                          {activity.quantityBefore} → <span className="font-semibold">{activity.quantityAfter}</span>
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
                      {activity.notes && (
                        <p className="text-xs text-gray-400 italic mt-1" title={activity.notes}>
                          {activity.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Belum ada aktivitas</p>
              </div>
            )}

            {/* Pagination - Bottom */}
            {activityData?.meta && activityData.meta.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3 border-t border-gray-200 mt-3">
                <button
                  onClick={() => setActivityPage((prev) => Math.max(1, prev - 1))}
                  disabled={activityPage === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Sebelumnya
                </button>
                <span className="text-sm text-gray-600">
                  {activityData.meta.page} / {activityData.meta.totalPages}
                </span>
                <button
                  onClick={() => setActivityPage((prev) => prev + 1)}
                  disabled={activityPage >= activityData.meta.totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Selanjutnya →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
