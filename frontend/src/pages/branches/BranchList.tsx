import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Store,
  Loader2,
  TrendingUp,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { branchesService } from '../../services/branches.service';
import { toast } from 'sonner';
import { Modal } from '../../components/ui/modal';

export default function BranchList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['branches', page, limit, searchTerm],
    queryFn: () => branchesService.getAll({
      page,
      limit,
      search: searchTerm || undefined,
      includeInactive: false,
    }),
  });

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => branchesService.delete(id),
    onSuccess: () => {
      toast.success('Cabang berhasil dihapus');
      setDeleteModalOpen(false);
      setBranchToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus cabang');
    },
  });

  const branches = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manajemen Cabang</h1>
            <p className="text-primary-100 text-lg">Kelola cabang dan lokasi</p>
          </div>
          <Link to="/branches/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              <span>Tambah Cabang</span>
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
              <Store className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-primary-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Cabang</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : pagination.total}</h3>
          <p className="text-xs text-gray-500">Semua cabang terdaftar</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Cabang</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama cabang, kode, lokasi, atau kontak..."
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Per Halaman</label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all bg-white min-w-[150px]"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">Tidak ada cabang</p>
            <p className="text-gray-400 text-sm mt-1">Mulai dengan menambahkan cabang baru</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Kode & Nama
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Lokasi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Kontak
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Statistik
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {branches.map((branch) => (
                  <tr
                    key={branch.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/branches/${branch.id}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
                      >
                        <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                          <Store className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{branch.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{branch.code}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          {branch.address && (
                            <p className="text-sm text-gray-900">{branch.address}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {[branch.city, branch.province].filter(Boolean).join(', ') || '-'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {branch.phone && <p>{branch.phone}</p>}
                        {branch.email && <p className="text-xs text-gray-500">{branch.email}</p>}
                        {!branch.phone && !branch.email && <p className="text-gray-400">-</p>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-600">
                        <p>Users: {branch.userCount || 0}</p>
                        <p>Stok: {branch.productStockCount || 0}</p>
                        <p>Transaksi: {branch.salesTransactionCount || 0}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          branch.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {branch.isActive ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/branches/${branch.id}/edit`);
                          }}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBranchToDelete({ id: branch.id, name: branch.name });
                            setDeleteModalOpen(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Menampilkan {(page - 1) * limit + 1} - {Math.min(page * limit, pagination.total)} dari{' '}
              {pagination.total} cabang
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setBranchToDelete(null);
        }}
        title="Hapus Cabang"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-800">
              Apakah Anda yakin ingin menghapus cabang <strong>{branchToDelete?.name}</strong>?
              <br />
              <span className="text-xs text-red-600 mt-1 block">
                Tindakan ini tidak dapat dibatalkan. Cabang akan dinonaktifkan.
              </span>
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setBranchToDelete(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (branchToDelete) {
                  deleteMutation.mutate(branchToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

