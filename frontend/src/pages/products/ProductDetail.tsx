import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Edit,
  ArrowLeft,
  Package,
  DollarSign,
  Loader2,
  Barcode,
  Tag,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { productsService } from '../../services/products.service';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsService.getById(id!),
    enabled: !!id,
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
  const isLowStock = (product.stock || 0) < (product.minStock || 0);

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
              <h1 className="text-4xl font-bold mb-2">{product.name}</h1>
              <p className="text-primary-100 text-lg">Detail produk dan informasi stok</p>
            </div>
          </div>
          <Link to={`/products/${id}/edit`}>
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Edit className="w-5 h-5" />
              <span>Edit Produk</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info - Enhanced */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Information */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
              <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-md">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Informasi Produk</h2>
                <p className="text-sm text-gray-600 mt-1">Data utama produk</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Barcode className="w-4 h-4" />
                  <span className="font-semibold">SKU</span>
                </div>
                <p className="text-lg font-bold text-gray-900 font-mono">{product.sku}</p>
              </div>
              {product.barcode && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Barcode className="w-4 h-4" />
                    <span className="font-semibold">Barcode</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 font-mono">{product.barcode}</p>
                </div>
              )}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Tag className="w-4 h-4" />
                  <span className="font-semibold">Kategori</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{product.category?.name || product.categoryId}</p>
              </div>
              {product.brand && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Tag className="w-4 h-4" />
                    <span className="font-semibold">Brand</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{product.brand.name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pricing - Enhanced */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-200">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Harga & Margin</h2>
                <p className="text-sm text-gray-600 mt-1">Analisis harga dan profitabilitas</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                <p className="text-sm font-semibold text-gray-600 mb-2">Harga Beli</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(product.costPrice)}</p>
              </div>
              <div className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl border-2 border-primary-200">
                <p className="text-sm font-semibold text-primary-700 mb-2">Harga Jual</p>
                <p className="text-3xl font-bold text-primary-600">{formatCurrency(product.sellingPrice)}</p>
              </div>
              <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
                <p className="text-sm font-semibold text-green-700 mb-2">Margin</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(margin)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">{marginPercent}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Enhanced */}
        <div className="space-y-6">
          {/* Stock Card */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Stok</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Stok Tersedia</p>
                <p className={`text-5xl font-bold ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                  {product.stock || 0}
                </p>
              </div>
              {product.minStock && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-1">Min Stock</p>
                  <p className="text-2xl font-semibold text-gray-900">{product.minStock}</p>
                </div>
              )}
              {isLowStock && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">Stok Rendah</p>
                      <p className="text-xs text-red-600 mt-1">Perlu restock segera</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Card */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
              <div className="p-2 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl">
                <Tag className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Status</h2>
            </div>
            <span
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border ${
                product.status === 'ACTIVE' || product.status === 'active'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-gray-100 text-gray-800 border-gray-200'
              }`}
            >
              {product.status === 'ACTIVE' || product.status === 'active' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
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
  );
}
