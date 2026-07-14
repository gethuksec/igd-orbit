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
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
        <Button
          variant="link"
          onClick={() => navigate('/suppliers')}
          className="mt-4"
        >
          Kembali ke daftar supplier
        </Button>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-gray-600 text-lg">Supplier tidak ditemukan</p>
        <Button
          variant="link"
          onClick={() => navigate('/suppliers')}
          className="mt-4"
        >
          Kembali ke daftar supplier
        </Button>
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
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/suppliers')}
          className="mt-2 text-gray-600 hover:bg-gray-100 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title={supplier.name}
            subtitle={
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono opacity-90">{supplier.customerCode || supplier.code}</span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Wholesale</span>
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
            }
          >
            {id && (
              <Link
                to={`/suppliers/${id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-white text-primary-600 rounded-lg hover:bg-primary-50 transition-all shadow-md font-medium"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </Link>
            )}
          </PageHeader>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-primary-600" />
                Kontak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 mb-1">Telepon</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{supplier.phone}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 bg-green-500 text-white hover:bg-green-600 rounded-lg"
                        onClick={() => {
                          const phoneNumber = supplier.phone.replace(/[^0-9]/g, '');
                          const message = encodeURIComponent(`Halo ${supplier.name}, ada yang bisa kami bantu?`);
                          window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
                        }}
                        title="Kirim WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </Button>
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
            </CardContent>
          </Card>

          {/* Products List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="w-5 h-5 text-primary-600" />
                Daftar Produk ({totalProducts})
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Purchase History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="w-5 h-5 text-primary-600" />
                Purchase History ({totalPurchases})
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Supplier Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-primary-600" />
                Informasi
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

          {/* Notes */}
          {supplierData.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-primary-600" />
                  Keterangan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {supplierData.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
