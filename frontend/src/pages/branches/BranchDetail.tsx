import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Edit,
  Store,
  Loader2,
  MapPin,
  Phone,
  Users,
  Package,
  Wrench,
  Calendar,
  ShoppingCart,
  ArrowRightLeft,
  Eye,
} from 'lucide-react';
import { branchesService } from '../../services/branches.service';

export default function BranchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: branch, isLoading } = useQuery({
    queryKey: ['branch', id],
    queryFn: () => branchesService.getById(id!),
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

  if (!branch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cabang tidak ditemukan</p>
        <button
          onClick={() => navigate('/branches')}
          className="mt-4 text-primary-600 hover:text-primary-700"
        >
          Kembali ke daftar cabang
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/branches')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">{branch.name}</h1>
              <p className="text-primary-100">Detail Cabang</p>
            </div>
          </div>
          <Link
            to={`/branches/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all"
          >
            <Edit className="w-4 h-4" />
            <span>Edit</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Informasi Cabang */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-primary-600" />
              Informasi Cabang
            </h2>
            <div className="space-y-4">
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
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    branch.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {branch.isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Gudang</p>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    branch.isWarehouse
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
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
            </div>
          </div>

          {/* Alamat & Lokasi */}
          {(branch.address || branch.city || branch.province) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                Alamat & Lokasi
              </h2>
              <div className="space-y-3">
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
              </div>
            </div>
          )}

          {/* Kontak */}
          {(branch.phone || branch.email) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-primary-600" />
                Kontak
              </h2>
              <div className="space-y-3">
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
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Statistik & Informasi Tambahan */}
        <div className="space-y-4">
          {/* Statistik Detail */}
          {loadingStats ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            </div>
          ) : detailedStats ? (
            <div className="space-y-4">
              {/* Stok Produk */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-600" />
                    Stok Produk
                  </h2>
                  <Link
                    to={`/inventory/stock?branchId=${id}`}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Lihat Detail
                  </Link>
                </div>
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
              </div>

              {/* Penjualan */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-purple-600" />
                    Penjualan
                  </h2>
                  <Link
                    to={`/sales/history?branchId=${id}`}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Lihat Detail
                  </Link>
                </div>
                <div className="space-y-3">
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
                </div>
              </div>

              {/* Service Order */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-orange-600" />
                    Service Order
                  </h2>
                  <Link
                    to={`/service-orders?branchId=${id}`}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Lihat Detail
                  </Link>
                </div>
                <div className="space-y-3">
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
                </div>
              </div>

              {/* Inventory & Users */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                    Inventory
                  </h2>
                  <div className="space-y-2">
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
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    Users
                  </h2>
                  <div className="space-y-2">
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
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-sm text-gray-500">Statistik tidak tersedia</p>
            </div>
          )}

          {/* Informasi Tambahan */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Informasi Tambahan
            </h2>
            <div className="space-y-3">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

