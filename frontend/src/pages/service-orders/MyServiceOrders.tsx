import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Wrench, Loader2, Filter } from 'lucide-react';
import { serviceOrdersService } from '@/services/service-orders.service';
import { useBranchStore } from '@/stores/branchStore';

const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function MyServiceOrders() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { currentBranchId } = useBranchStore();
  const user = getCurrentUser();
  const technicianId = user?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-service-orders', page, searchTerm, selectedStatus, currentBranchId, technicianId],
    queryFn: () =>
      serviceOrdersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        branchId: currentBranchId || undefined,
        technicianId,
      }),
    enabled: !!technicianId,
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, selectedStatus, refetch]);

  const orders = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: orders.length, totalPages: 1 };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'DIAGNOSED':
      case 'QUOTED':
      case 'APPROVED':
      case 'IN-PROGRESS':
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'QC':
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Service Saya</h1>
            <p className="text-emerald-100 text-sm md:text-base">
              Daftar service order yang sedang ditangani oleh kamu sebagai teknisi
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as Error).message || 'Terjadi kesalahan saat memuat data service.'}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Cari Service Order
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nomor service, pelanggan, atau perangkat..."
                className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm md:text-base transition-all"
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
                className="block w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm md:text-base appearance-none bg-white transition-all"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Pending</option>
                <option value="DIAGNOSED">Diagnosed</option>
                <option value="APPROVED">Approved</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="QC">QC</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
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
                  Perangkat
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Status
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
                      <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-base">
                        Memuat daftar service kamu...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Wrench className="w-12 h-12 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-base">
                        Belum ada service yang ditugaskan ke kamu
                      </p>
                      <p className="text-gray-400 text-sm">
                        HS/SPV dapat meng-assign service order ke teknisi dari halaman Service Order
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order: any) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{order.serviceNumber}</div>
                      {order.internalNumber && (
                        <div className="text-xs text-gray-500">{order.internalNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.customerName || order.customer?.name || 'Walk-in Customer'}
                      </div>
                      {order.customerPhone && (
                        <div className="text-xs text-gray-500">{order.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.deviceBrand || '-'} {order.deviceModel}
                      </div>
                      {order.deviceType && (
                        <div className="text-xs text-gray-500 uppercase">{order.deviceType}</div>
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
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        to={`/service-orders/${order.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Wrench className="w-4 h-4" />
                        <span>Detail</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && orders.length > 0 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Menampilkan{' '}
              <span className="font-bold text-gray-900">{orders.length}</span> dari{' '}
              <span className="font-bold text-gray-900">{pagination.total}</span> service
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-emerald-500 hover:text-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-emerald-500 hover:text-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


