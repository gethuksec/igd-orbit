import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Users,
  Mail,
  Phone,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { usersService } from '../../services/users.service';
import { toast } from 'sonner';
import { Modal } from '../../components/ui/modal';
import RequirePermission from '../../components/guards/RequirePermission';

export default function UserList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 20 | 50 | 100>(20);
  const [sortBy, setSortBy] = useState<'createdAt' | 'fullName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; fullName: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users', page, limit, searchTerm, sortBy, sortOrder],
    queryFn: async () => {
      try {
        const result = await usersService.getAll({
          page,
          limit,
          search: searchTerm || undefined,
          sort: sortBy,
          order: sortOrder,
        });
        console.log('✅ Users API response:', result);
        return result;
      } catch (err) {
        console.error('❌ Users API error:', err);
        throw err;
      }
    },
  });

  useEffect(() => {
    if (error) {
      const errorResponse = error as any;
      console.error('Error fetching users:', errorResponse);
      if (errorResponse.response?.status === 403) {
        toast.error('Akses ditolak. Anda tidak memiliki izin untuk melihat daftar pengguna.');
      } else if (errorResponse.response?.status === 401) {
        toast.error('Session expired. Silakan login kembali.');
      } else {
        const errorMessage = errorResponse.response?.data?.message || errorResponse.message || 'Gagal memuat daftar pengguna';
        console.error('Error details:', {
          status: errorResponse.response?.status,
          data: errorResponse.response?.data,
          message: errorMessage,
        });
        toast.error(errorMessage);
      }
    }
  }, [error]);
  
  // Log for debugging
  useEffect(() => {
    if (data) {
      console.log('Users data:', data);
      console.log('Users array:', data?.data || []);
      console.log('Users count:', data?.data?.length || 0);
      console.log('Pagination:', data?.meta);
    }
  }, [data]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const users = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      toast.success('Pengguna berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteModalOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus pengguna');
    },
  });

  const handleDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Pengguna</h1>
          <p className="text-gray-600 mt-1">Kelola pengguna dan akses sistem</p>
        </div>
        <RequirePermission permission="users.create" fallbackRoles={['SUPERADMIN', 'CHR']}>
          <Link to="/users/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              <span>Tambah Pengguna</span>
            </button>
          </Link>
        </RequirePermission>
      </div>

      {/* Statistics Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 group hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Pengguna</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : pagination.total}</h3>
          <p className="text-xs text-gray-500">Semua pengguna terdaftar</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 group hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Pengguna Aktif</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {isLoading ? '-' : users.filter((u) => u.isActive).length}
          </h3>
          <p className="text-xs text-gray-500">Pengguna yang aktif</p>
        </div>
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 group hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl">
              <XCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Pengguna Non-Aktif</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {isLoading ? '-' : users.filter((u) => !u.isActive).length}
          </h3>
          <p className="text-xs text-gray-500">Pengguna yang dinonaktifkan</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Pengguna</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama, email, atau telepon..."
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
                  const newLimit = parseInt(e.target.value) as 10 | 20 | 50 | 100;
                  setLimit(newLimit);
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

      {/* User Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  <button
                    onClick={() => {
                      if (sortBy === 'fullName') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('fullName');
                        setSortOrder('asc');
                      }
                      setPage(1);
                    }}
                    className="flex items-center gap-2 hover:text-primary-600 transition-colors w-full text-left"
                  >
                    Nama & Email
                    {sortBy === 'fullName' && (
                      <span className="text-primary-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Telepon
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  <button
                    onClick={() => {
                      if (sortBy === 'createdAt') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('createdAt');
                        setSortOrder('desc');
                      }
                      setPage(1);
                    }}
                    className="flex items-center gap-2 hover:text-primary-600 transition-colors w-full text-left"
                  >
                    Tanggal Dibuat
                    {sortBy === 'createdAt' && (
                      <span className="text-primary-600">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </button>
                </th>
                <th className="px-8 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat data pengguna...</p>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Users className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada pengguna ditemukan</p>
                      <RequirePermission permission="users.create" fallbackRoles={['SUPERADMIN', 'CHR']}>
                        <Link to="/users/new">
                          <button className="mt-2 flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 shadow-lg transition-all">
                            <Plus className="w-5 h-5" />
                            <span>Tambah Pengguna Pertama</span>
                          </button>
                        </Link>
                      </RequirePermission>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/users/${user.id}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                        <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900 hover:text-primary-600 transition-colors">
                            {user.fullName}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Mail className="w-3 h-3" />
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {user.phone ? (
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{user.phone}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => {
                            // Support both formats: new format (code/name directly) and legacy format (role.code/role.name)
                            const roleName = role.name || role.role?.name || 'Unknown Role';
                            return (
                              <span
                                key={role.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-md text-xs font-medium"
                              >
                                <Shield className="w-3 h-3" />
                                {roleName}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-gray-400 italic text-xs">Tidak ada role</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          Non-Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(user.createdAt).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(user.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/users/${user.id}`}>
                          <button
                            className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <RequirePermission permission="users.update" fallbackRoles={['SUPERADMIN', 'CHR']}>
                          <Link to={`/users/${user.id}/edit`}>
                            <button
                              className="p-2.5 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </Link>
                        </RequirePermission>
                        <RequirePermission permission="users.delete" fallbackRoles={['SUPERADMIN']}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserToDelete({ id: user.id, fullName: user.fullName });
                              setDeleteModalOpen(true);
                            }}
                            className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </RequirePermission>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && users.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Menampilkan <span className="font-bold text-gray-900">{users.length}</span> dari{' '}
                <span className="font-bold text-gray-900">{pagination.total}</span> pengguna
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        title="Hapus Pengguna"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Apakah Anda yakin ingin menghapus pengguna <strong>{userToDelete?.fullName}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Tindakan ini tidak dapat dibatalkan. Semua data pengguna akan dihapus secara permanen.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setUserToDelete(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

