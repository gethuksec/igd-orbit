import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Edit, Eye, Wrench, Loader2, Filter, TrendingUp, UserCircle } from 'lucide-react';
import { serviceOrdersService } from '../../services/service-orders.service';
import { useBranchStore } from '@/stores/branchStore';
import { api } from '@/services/api';

export default function ServiceOrderList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { currentBranchId } = useBranchStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['service-orders', page, searchTerm, selectedStatus, selectedTechnician, currentBranchId],
    queryFn: () =>
      serviceOrdersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        branchId: currentBranchId || undefined,
        technicianId: selectedTechnician !== 'ALL' ? selectedTechnician : undefined,
      }),
  });

  const { data: technicians } = useQuery({
    queryKey: ['technicians'],
    queryFn: async () => {
      try {
        const res = await api.get('/users', {
          params: {
            page: 1,
            limit: 100,
            'filter[role]': 'TC',
          },
        });
        const raw = res.data?.data || res.data || [];
        // Extra safety: filter client-side to only technician roles
        return raw.filter((user: any) =>
          Array.isArray(user.roles) &&
          user.roles.some((r: any) => r.code === 'TC'),
        );
      } catch (error) {
        return [];
      }
    },
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, selectedTechnician, refetch]);

  const orders = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const getStatusColor = (status: string) => {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'pending':
      case 'diagnosed':
      case 'quoted':
      case 'approved':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in-progress':
      case 'qc':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Grouped counts by phase
  const pendingCount = orders.filter((o) =>
    ['pending', 'diagnosed', 'quoted', 'approved'].includes(
      String(o.status || '').toLowerCase(),
    ),
  ).length;
  const inProgressCount = orders.filter((o) =>
    ['in-progress', 'qc'].includes(String(o.status || '').toLowerCase()),
  ).length;
  const completedCount = orders.filter((o) =>
    ['completed', 'delivered'].includes(String(o.status || '').toLowerCase()),
  ).length;

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manajemen Service Order</h1>
            <p className="text-primary-100 text-lg">Kelola pesanan servis dan perbaikan</p>
          </div>
          <Link to="/service-orders/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              <span>Tambah Service Order</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">{(error as Error).message || 'Terjadi kesalahan'}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl group-hover:scale-110 transition-transform">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-primary-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Order</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : pagination.total}</h3>
          <p className="text-xs text-gray-500">Semua service order</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl group-hover:scale-110 transition-transform">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
              Pending
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Pending</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : pendingCount}</h3>
          <p className="text-xs text-gray-500">Menunggu penanganan</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
              Progress
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">In Progress</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : inProgressCount}</h3>
          <p className="text-xs text-gray-500">Sedang dikerjakan</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl group-hover:scale-110 transition-transform">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
              Done
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Completed</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : completedCount}</h3>
          <p className="text-xs text-gray-500">Selesai</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Service Order</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nomor service atau nama pelanggan..."
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              />
            </div>
          </div>

          <div className="lg:w-64">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
              >
                <option value="ALL">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="diagnosed">Diagnosed</option>
                <option value="quoted">Quoted</option>
                <option value="approved">Approved</option>
                <option value="in-progress">In Progress</option>
                <option value="qc">QC</option>
                <option value="completed">Completed</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="lg:w-64">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Teknisi</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <UserCircle className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedTechnician}
                onChange={(e) => setSelectedTechnician(e.target.value)}
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
              >
                <option value="ALL">Semua Teknisi</option>
                {(technicians || []).map((tech: any) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.fullName || tech.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Nomor Service
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Pelanggan
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat data service order...</p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Wrench className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada service order ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{order.serviceNumber}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.customerName || order.customer?.name || 'Walk-in Customer'}
                      </div>
                      {(order.customerPhone || order.customer?.phone) && (
                        <div className="text-xs text-gray-500">
                          {order.customerPhone || order.customer?.phone}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${getStatusColor(
                          order.status,
                        )}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(order.createdAt).toLocaleDateString('id-ID')}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/service-orders/${order.id}`}>
                          <button
                            className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <Link to={`/service-orders/${order.id}/edit`}>
                          <button
                            className="p-2.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && orders.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Menampilkan <span className="font-bold text-gray-900">{orders.length}</span> dari{' '}
                <span className="font-bold text-gray-900">{pagination.total}</span> service order
                <span className="ml-2 text-gray-500">
                  (Halaman {pagination.page} dari {pagination.totalPages})
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-primary-500 hover:text-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-primary-500 hover:text-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
