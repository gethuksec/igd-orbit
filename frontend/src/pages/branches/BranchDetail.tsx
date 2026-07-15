import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Edit,
  ArrowLeft,
  Store,
  MapPin,
  Phone,
  Users,
  Package,
  Wrench,
  Calendar,
  ShoppingCart,
  ArrowRightLeft,
  Eye,
  Loader2,
} from 'lucide-react';
import { branchesService } from '../../services/branches.service';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BranchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: branch, isLoading, error } = useQuery({
    queryKey: ['branch', id],
    queryFn: () => branchesService.getById(id!),
    enabled: !!id,
    retry: 1,
  });

  const { data: detailedStats, isLoading: loadingStats } = useQuery({
    queryKey: ['branch-stats', id],
    queryFn: () => branchesService.getDetailedStats(id!),
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

  if (error || !branch) {
    return (
      <div className="w-full text-center py-12">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm max-w-md mx-auto">
          <p className="text-red-800 font-medium">
            {(error as Error)?.message || 'Cabang tidak ditemukan'}
          </p>
        </div>
        <Button
          variant="link"
          onClick={() => navigate('/branches')}
          className="mt-4"
        >
          Kembali ke daftar cabang
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={branch.name}
        subtitle="Detail Cabang"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/branches')}
          className="text-white/80 hover:text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Kembali
        </Button>
        <Link
          to={`/branches/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
        >
          <Edit className="w-4 h-4" />
          <span>Edit</span>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Cabang */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary-600" />
                Informasi Cabang
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Nama Cabang</p>
                <p className="text-sm font-semibold text-gray-900">{branch.name}</p>
              </div>
              {branch.code && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Kode Cabang</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">{branch.code}</p>
                </div>
              )}
              {branch.type && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Tipe Cabang</p>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{branch.type}</p>
                </div>
              )}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    branch.isActive
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  {branch.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Gudang</p>
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    branch.isWarehouse
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }`}
                >
                  {branch.isWarehouse ? 'Memiliki Gudang' : 'Tidak Memiliki Gudang'}
                </span>
              </div>
              {branch.headOfService && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Head of Service (HS)</p>
                  <p className="text-sm font-semibold text-gray-900">{branch.headOfService.name}</p>
                  {branch.headOfService.email && (
                    <p className="text-xs text-gray-500 mt-1">{branch.headOfService.email}</p>
                  )}
                  {branch.headOfService.phone && (
                    <p className="text-xs text-gray-500">{branch.headOfService.phone}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alamat & Lokasi */}
          {(branch.address || branch.city || branch.province) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  Alamat & Lokasi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {branch.address && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Alamat Lengkap</p>
                    <p className="text-sm text-gray-700">{branch.address}</p>
                  </div>
                )}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Kota & Provinsi</p>
                  <p className="text-sm text-gray-700">
                    {[branch.city, branch.province].filter(Boolean).join(', ') || '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Kontak */}
          {(branch.phone || branch.email) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary-600" />
                  Kontak
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {branch.phone && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Telepon</p>
                    <p className="text-sm text-gray-700">{branch.phone}</p>
                  </div>
                )}
                {branch.email && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="text-sm text-gray-700">{branch.email}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Statistik & Informasi Tambahan */}
        <div className="space-y-4">
          {loadingStats ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </CardContent>
            </Card>
          ) : detailedStats ? (
            <div className="space-y-4">
              {/* Stok Produk */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-green-600" />
                      Stok Produk
                    </CardTitle>
                    <Link
                      to={`/inventory/stock?branchId=${id}`}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Lihat Detail
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs text-green-600 font-medium mb-1">Total Stok</p>
                      <p className="text-xl font-bold text-green-600">
                        {detailedStats.stock.totalQuantity.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-green-500 mt-1">
                        {detailedStats.stock.productStockRecords} produk
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-600 font-medium mb-1">Tersedia</p>
                      <p className="text-xl font-bold text-blue-600">
                        {detailedStats.stock.totalAvailable.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-xs text-yellow-600 font-medium mb-1">Reserved</p>
                      <p className="text-xl font-bold text-yellow-600">
                        {detailedStats.stock.totalReserved.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs text-red-600 font-medium mb-1">Rusak</p>
                      <p className="text-xl font-bold text-red-600">
                        {detailedStats.stock.totalDamaged.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Penjualan */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-purple-600" />
                      Penjualan
                    </CardTitle>
                    <Link
                      to={`/sales/history?branchId=${id}`}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Lihat Detail
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-purple-600 font-medium">Total Transaksi</p>
                      <p className="text-sm font-semibold text-purple-600">
                        {detailedStats.sales.totalTransactions} transaksi
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-purple-500">Selesai</p>
                      <p className="text-xs text-purple-500">
                        {detailedStats.sales.completedTransactions} transaksi
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-600 font-medium mb-1">Total Revenue</p>
                    <p className="text-xl font-bold text-purple-600">
                      {formatCurrency(detailedStats.sales.completedRevenue)}
                    </p>
                    <div className="text-xs text-purple-500 mt-2 space-y-0.5">
                      <p>Subtotal: {formatCurrency(detailedStats.sales.totalSubtotal)}</p>
                      <p>Diskon: {formatCurrency(detailedStats.sales.totalDiscount)}</p>
                      <p>Pajak: {formatCurrency(detailedStats.sales.totalTax)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Order */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-orange-600" />
                      Service Order
                    </CardTitle>
                    <Link
                      to={`/service-orders?branchId=${id}`}
                      className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Lihat Detail
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-orange-600 font-medium">Total Order</p>
                      <p className="text-sm font-semibold text-orange-600">
                        {detailedStats.service.totalOrders} order
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-orange-500">Selesai</p>
                      <p className="text-xs text-orange-500">
                        {detailedStats.service.completedOrders} order
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                    <p className="text-xs text-orange-600 font-medium mb-1">Total Revenue</p>
                    <p className="text-xl font-bold text-orange-600">
                      {formatCurrency(detailedStats.service.completedRevenue)}
                    </p>
                    <div className="text-xs text-orange-500 mt-2 space-y-0.5">
                      <p>Jasa: {formatCurrency(detailedStats.service.totalLaborCost)}</p>
                      <p>Sparepart: {formatCurrency(detailedStats.service.totalPartsCost)}</p>
                      <p>Diskon: {formatCurrency(detailedStats.service.totalDiscount)}</p>
                      <p>Pajak: {formatCurrency(detailedStats.service.totalTax)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Inventory & Users */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                      Inventory
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">Stock Movements</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {detailedStats.inventory.stockMovements}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">Transfer Keluar</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {detailedStats.inventory.stockTransfersFrom}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">Transfer Masuk</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {detailedStats.inventory.stockTransfersTo}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">Stock Opname</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {detailedStats.inventory.stockOpnames}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">User Roles</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {detailedStats.users.userRoles}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">Karyawan</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {detailedStats.users.employees}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-gray-500 text-center">Statistik tidak tersedia</p>
              </CardContent>
            </Card>
          )}

          {/* Informasi Tambahan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                Informasi Tambahan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Dibuat</p>
                <p className="text-sm text-gray-700">
                  {new Date(branch.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Diupdate</p>
                <p className="text-sm text-gray-700">
                  {new Date(branch.updatedAt).toLocaleString('id-ID', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
