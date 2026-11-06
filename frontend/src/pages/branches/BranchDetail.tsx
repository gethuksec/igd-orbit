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
import { warehousesService } from '../../services/warehouses.service';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import { BreadcrumbHeader } from '@/components/shared';
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

  const { data: warehouses, isLoading: whLoading } = useQuery({
    queryKey: ['branch-warehouses', id],
    queryFn: async () => {
      if (!id) return [];
      const res = await warehousesService.getAll({ outletId: id, status: 'all', limit: 100 });
      return res.data || [];
    },
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
        <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
      </div>
    );
  }

  if (error || !branch) {
    return (
      <div className="w-full text-center py-12">
        <div className="bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg p-4 shadow-sm max-w-md mx-auto">
          <p className="text-red-800 dark:text-red-200 font-medium">
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
      <BreadcrumbHeader
        title={branch.name}
        subtitle="Detail Cabang"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/branches')}

        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Kembali
        </Button>
        <Link
          to={`/branches/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
        >
          <Edit className="w-4 h-4" />
          <span>Edit</span>
        </Link>
      </BreadcrumbHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Cabang */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Informasi Cabang
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nama Cabang</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{branch.name}</p>
              </div>
              {branch.code && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kode Cabang</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">{branch.code}</p>
                </div>
              )}
              {branch.group && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Grup</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{branch.group}</p>
                </div>
              )}
              <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                <span
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    branch.isActive
                      ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {branch.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
              {branch.director && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Direktur</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{branch.director}</p>
                </div>
              )}
              {branch.contactPerson && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Contact Person</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{branch.contactPerson}</p>
                  {branch.mobilePhone && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{branch.mobilePhone}</p>
                  )}
                </div>
              )}
              {branch.headOfService && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Head of Service (HS)</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{branch.headOfService.name}</p>
                  {branch.headOfService.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{branch.headOfService.email}</p>
                  )}
                  {branch.headOfService.phone && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{branch.headOfService.phone}</p>
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
                  <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Alamat & Lokasi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {branch.address && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Alamat Lengkap</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{branch.address}</p>
                  </div>
                )}
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Kota & Provinsi</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
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
                  <Phone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Kontak
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {branch.phone && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Telepon</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{branch.phone}</p>
                  </div>
                )}
                {branch.email && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{branch.email}</p>
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
                <Loader2 className="w-6 h-6 text-primary-600 dark:text-primary-400 animate-spin" />
              </CardContent>
            </Card>
          ) : detailedStats ? (
            <div className="space-y-4">
              {/* Stok Produk */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                      Stok Produk
                    </CardTitle>
                    <Link
                      to={`/inventory/stock?branchId=${id}`}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Lihat Detail
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Total Stok</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {detailedStats.stock.totalQuantity.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                        {detailedStats.stock.productStockRecords} produk
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Tersedia</p>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {detailedStats.stock.totalAvailable.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mb-1">Reserved</p>
                      <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                        {detailedStats.stock.totalReserved.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Rusak</p>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">
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
                      <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      Penjualan
                    </CardTitle>
                    <Link
                      to={`/sales/history?branchId=${id}`}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Lihat Detail
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Total Transaksi</p>
                      <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                        {detailedStats.sales.totalTransactions} transaksi
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-purple-500 dark:text-purple-400">Selesai</p>
                      <p className="text-xs text-purple-500 dark:text-purple-400">
                        {detailedStats.sales.completedTransactions} transaksi
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-50 dark:from-purple-950 to-purple-100 dark:to-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Total Revenue</p>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(detailedStats.sales.completedRevenue)}
                    </p>
                    <div className="text-xs text-purple-500 dark:text-purple-400 mt-2 space-y-0.5">
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
                      <Wrench className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      Service Order
                    </CardTitle>
                    <Link
                      to={`/service-orders?branchId=${id}`}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Lihat Detail
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">Total Order</p>
                      <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                        {detailedStats.service.totalOrders} order
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-orange-500 dark:text-orange-400">Selesai</p>
                      <p className="text-xs text-orange-500 dark:text-orange-400">
                        {detailedStats.service.completedOrders} order
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-orange-50 dark:from-orange-950 to-orange-100 dark:to-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium mb-1">Total Revenue</p>
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(detailedStats.service.completedRevenue)}
                    </p>
                    <div className="text-xs text-orange-500 dark:text-orange-400 mt-2 space-y-0.5">
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
                      <ArrowRightLeft className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      Inventory
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Stock Movements</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {detailedStats.inventory.stockMovements}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Transfer Keluar</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {detailedStats.inventory.stockTransfersFrom}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Transfer Masuk</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {detailedStats.inventory.stockTransfersTo}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Stock Opname</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {detailedStats.inventory.stockOpnames}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 dark:text-gray-400">User Roles</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {detailedStats.users.userRoles}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Karyawan</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
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
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Statistik tidak tersedia</p>
              </CardContent>
            </Card>
          )}

          {/* Informasi Tambahan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Informasi Tambahan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dibuat</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {new Date(branch.createdAt).toLocaleString('id-ID', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Diupdate</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {new Date(branch.updatedAt).toLocaleString('id-ID', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gudang Outlet Ini (D3) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Gudang Outlet Ini
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {whLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-spin" />
                </div>
              ) : (warehouses || []).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
                  Belum ada gudang untuk outlet ini.
                </p>
              ) : (
                (warehouses || []).map((wh: any) => (
                  <Link
                    key={wh.id}
                    to={`/warehouses/${wh.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/40 dark:hover:bg-primary-950/40 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{wh.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{wh.code}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                          wh.isActive
                            ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {wh.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                      <Eye className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    </div>
                  </Link>
                ))
              )}
              <Link
                to={`/warehouses?outletId=${id}`}
                className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 pt-1"
              >
                <WarehouseIcon className="w-3 h-3" />
                Lihat semua gudang
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
