import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Edit,
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Package,
  ShoppingCart,
  FileText,
  MessageCircle,
} from 'lucide-react';
import { suppliersService } from '../../services/suppliers.service';
import { api } from '../../services/api';

export default function SupplierDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: supplier, isLoading, error } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => suppliersService.getById(id!),
    enabled: !!id,
    retry: 1,
  });

  const { data: products } = useQuery({
    queryKey: ['supplier-products', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/suppliers/${id}/products`);
        return response.data;
      } catch {
        return { data: [] };
      }
    },
    enabled: !!id,
  });

  const { data: purchases } = useQuery({
    queryKey: ['supplier-purchases', id],
    queryFn: async () => {
      try {
        const response = await api.get(`/suppliers/${id}/purchases?page=1&limit=10`);
        return response.data;
      } catch {
        return { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
      }
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full text-center py-12">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm max-w-md mx-auto">
          <p className="text-red-800 font-medium">
            {(error as Error).message || 'Terjadi kesalahan saat memuat data supplier'}
          </p>
        </div>
        <button
          onClick={() => navigate('/suppliers')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          Kembali ke daftar supplier
        </button>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-600 text-lg">Supplier tidak ditemukan</p>
        <button
          onClick={() => navigate('/suppliers')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          Kembali ke daftar supplier
        </button>
      </div>
    );
  }

  const supplierData = supplier as any;
  const productsList = products?.data || [];
  const purchasesList = purchases?.data || [];
  const totalProducts = productsList.length;
  const totalPurchases = purchases?.meta?.total || 0;

  return (
    <div className="w-full space-y-4">
      {/* Compact Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/suppliers')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
                {supplier.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500 font-mono">{supplier.customerCode || supplier.code}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">Wholesale</span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      supplier.isActive
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    {supplier.isActive ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Link
            to={`/suppliers/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-md"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-600" />
              Kontak
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 mb-1">Telepon</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{supplier.phone}</p>
                    <button
                      onClick={() => {
                        const phoneNumber = supplier.phone.replace(/[^0-9]/g, '');
                        const message = encodeURIComponent(`Halo ${supplier.name}, ada yang bisa kami bantu?`);
                        window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
                      }}
                      className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      title="Kirim WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {supplierData.alternatePhone && (
                    <p className="text-xs text-gray-600 mt-1">Alt: {supplierData.alternatePhone}</p>
                  )}
                </div>
              </div>
              {supplier.email && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 break-all">{supplier.email}</p>
                      <a
                        href={`mailto:${supplier.email}?subject=Halo ${supplier.name}`}
                        className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        title="Kirim Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
              {supplier.address && (
                <div className="md:col-span-2 flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Alamat</p>
                    <p className="text-sm font-semibold text-gray-900">{supplier.address}</p>
                    {(supplierData.city || supplierData.province) && (
                      <p className="text-xs text-gray-600 mt-1">
                        {[supplierData.city, supplierData.province, supplierData.postalCode].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {supplierData.contactPerson && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Contact Person</p>
                <p className="text-sm font-semibold text-gray-900">{supplierData.contactPerson}</p>
              </div>
            )}
          </div>

          {/* Products List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              Daftar Produk ({totalProducts})
            </h2>
            {productsList.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {productsList.map((product: any) => (
                  <Link
                    key={product.id}
                    to={`/products/${product.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 font-mono">{product.sku}</span>
                        {product.category && (
                          <span className="text-xs text-gray-500">• {product.category.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-gray-500">Stok</p>
                      <p className="text-sm font-bold text-primary-600">{product.totalStock || 0}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Belum ada produk</p>
              </div>
            )}
          </div>

          {/* Purchase History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary-600" />
              Purchase History ({totalPurchases})
            </h2>
            {purchasesList.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {purchasesList.map((purchase: any) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{purchase.product?.name || '-'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          Qty: {Math.abs(purchase.quantity || 0)} {purchase.product?.sku || ''}
                        </span>
                        {purchase.branch && (
                          <span className="text-xs text-gray-500">• {purchase.branch.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          purchase.movementType === 'IN' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {purchase.movementType || purchase.referenceType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {purchase.createdAt
                          ? new Date(purchase.createdAt).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-gray-500">Quantity</p>
                      <p className="text-sm font-bold text-primary-600">
                        {Math.abs(purchase.quantity || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Belum ada purchase history</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Supplier Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-600" />
              Informasi
            </h2>
            <div className="space-y-3">
              <div className="p-3 bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg border border-primary-200">
                <p className="text-xs text-primary-600 mb-1">Kode Supplier</p>
                <p className="text-base font-bold text-primary-900 font-mono">
                  {supplier.customerCode || supplier.code || '-'}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Jenis Supplier</p>
                <p className="text-sm font-semibold text-gray-900">Wholesale</p>
              </div>
              {supplierData.createdAt && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Terdaftar Sejak</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(supplierData.createdAt).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {supplierData.notes && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Keterangan
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200">
                {supplierData.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
