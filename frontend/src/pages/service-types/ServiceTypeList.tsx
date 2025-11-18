import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Wrench,
  Loader2,
  TrendingUp,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { serviceTypesService } from '../../services/service-types.service';
import { toast } from 'sonner';
import { Modal } from '../../components/ui/modal';

export default function ServiceTypeList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceTypeToDelete, setServiceTypeToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: serviceTypes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['service-types', searchTerm],
    queryFn: () => serviceTypesService.getAll(),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, refetch]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => serviceTypesService.delete(id),
    onSuccess: () => {
      toast.success('Layanan berhasil dihapus');
      setDeleteModalOpen(false);
      setServiceTypeToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['service-types'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus layanan');
    },
  });

  // Filter by search term
  const filteredServiceTypes = serviceTypes.filter((st) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      st.name.toLowerCase().includes(search) ||
      st.code.toLowerCase().includes(search) ||
      (st.description && st.description.toLowerCase().includes(search))
    );
  });

  const activeCount = serviceTypes.filter((st) => st.isActive).length;
  const totalServiceOrders = serviceTypes.reduce((acc, st) => acc + (st.serviceOrderCount || 0), 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatSLA = (hours: number) => {
    if (hours < 24) {
      return `${hours} jam`;
    }
    return `${Math.floor(hours / 24)} hari`;
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manajemen Layanan</h1>
            <p className="text-primary-100 text-lg">Kelola jenis layanan servis</p>
          </div>
          <Link to="/service-types/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              <span>Tambah Layanan</span>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl group-hover:scale-110 transition-transform">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-primary-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Layanan</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : serviceTypes.length}</h3>
          <p className="text-xs text-gray-500">Semua layanan terdaftar</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl group-hover:scale-110 transition-transform">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Service Order</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : totalServiceOrders}</h3>
          <p className="text-xs text-gray-500">Dari semua layanan</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
              Active
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Layanan Aktif</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : activeCount}</h3>
          <p className="text-xs text-gray-500">Sedang aktif</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama layanan, kode, atau deskripsi..."
            className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
          />
        </div>
      </div>

      {/* Service Types Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Layanan
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Harga
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  SLA
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Service Order
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
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat data layanan...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredServiceTypes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Wrench className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada layanan ditemukan</p>
                      <Link to="/service-types/new">
                        <button className="mt-2 flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 shadow-lg transition-all">
                          <Plus className="w-5 h-5" />
                          <span>Tambah Layanan Pertama</span>
                        </button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredServiceTypes.map((serviceType) => (
                  <tr
                    key={serviceType.id}
                    onClick={() => navigate(`/service-types/${serviceType.id}`)}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-md">
                          <Wrench className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900">{serviceType.name}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{serviceType.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {serviceType.minPrice && serviceType.maxPrice ? (
                          <div>
                            <div className="font-semibold text-gray-900">
                              {formatPrice(serviceType.minPrice)} - {formatPrice(serviceType.maxPrice)}
                            </div>
                            <div className="text-xs text-gray-500">Base: {formatPrice(serviceType.basePrice)}</div>
                          </div>
                        ) : (
                          <div className="font-semibold text-gray-900">{formatPrice(serviceType.basePrice)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{formatSLA(serviceType.slaHours)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{serviceType.serviceOrderCount || 0}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                          serviceType.isActive
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        {serviceType.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/service-types/${serviceType.id}`}>
                          <button
                            className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <Link to={`/service-types/${serviceType.id}/edit`}>
                          <button
                            className="p-2.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setServiceTypeToDelete({ id: serviceType.id, name: serviceType.name });
                            setDeleteModalOpen(true);
                          }}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setServiceTypeToDelete(null);
        }}
        title="Konfirmasi Hapus"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-red-100 rounded-full">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 mb-2">
                Apakah Anda yakin ingin menghapus layanan <strong>{serviceTypeToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-gray-500">
                Tindakan ini akan melakukan soft delete (set isActive = false). Layanan tidak akan muncul di daftar, tetapi masih tersimpan di database.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setServiceTypeToDelete(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={deleteMutation.isPending}
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (serviceTypeToDelete) {
                  deleteMutation.mutate(serviceTypeToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

