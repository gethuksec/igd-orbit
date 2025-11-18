import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Building2,
  Phone,
  Mail,
  Loader2,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { suppliersService } from '../../services/suppliers.service';
import { toast } from 'sonner';
import { Modal } from '../../components/ui/modal';

export default function SupplierList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 20 | 50 | 100>(20);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['suppliers', page, limit, searchTerm, sortBy, sortOrder],
    queryFn: () => suppliersService.getAll({
      page,
      limit,
      search: searchTerm || undefined,
      sort: sortBy,
      order: sortOrder,
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
    mutationFn: (id: string) => suppliersService.delete(id),
    onSuccess: () => {
      toast.success('Supplier berhasil dihapus');
      setDeleteModalOpen(false);
      setSupplierToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus supplier');
    },
  });

  const suppliers = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manajemen Supplier</h1>
            <p className="text-primary-100 text-lg">Kelola data supplier dan vendor</p>
          </div>
          <Link to="/suppliers/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              <span>Tambah Supplier</span>
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
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-primary-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Supplier</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : pagination.total}</h3>
          <p className="text-xs text-gray-500">Semua supplier terdaftar</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
              Active
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Supplier Aktif</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {isLoading ? '-' : suppliers.filter((s: any) => s.isActive).length}
          </h3>
          <p className="text-xs text-gray-500">Sedang aktif</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Produk</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {isLoading ? '-' : suppliers.reduce((acc: number, s: any) => acc + (s.productCount || 0), 0)}
          </h3>
          <p className="text-xs text-gray-500">Dari semua supplier</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Supplier</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama supplier, kontak, atau alamat..."
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
              />
            </div>
          </div>
          <div className="lg:w-64 w-full">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Per Halaman</label>
            <select
              value={limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value) as 10 | 20 | 50 | 100;
                setLimit(newLimit);
                setPage(1);
              }}
              className="block w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  <button
                    onClick={() => {
                      if (sortBy === 'name') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('name');
                        setSortOrder('asc');
                      }
                      setPage(1);
                    }}
                    className="flex items-center gap-2 hover:text-primary-600 transition-colors w-full text-left"
                    title="Klik untuk mengurutkan berdasarkan nama (a-z / z-a)"
                  >
                    Kode & Nama
                    {sortBy === 'name' && (
                      <span className="text-primary-600">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Kontak
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Alamat
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
                    title="Klik untuk mengurutkan berdasarkan tanggal (terbaru / terlama)"
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
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat data supplier...</p>
                    </div>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Building2 className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada supplier ditemukan</p>
                      <Link to="/suppliers/new">
                        <button className="mt-2 flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 shadow-lg transition-all">
                          <Plus className="w-5 h-5" />
                          <span>Tambah Supplier Pertama</span>
                        </button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier: any) => (
                  <tr
                    key={supplier.id}
                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/suppliers/${supplier.id}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {supplier.name?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900 hover:text-primary-600 transition-colors">{supplier.name}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{supplier.customerCode || supplier.code || '-'}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        {supplier.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{supplier.phone}</span>
                          </div>
                        )}
                        {supplier.alternatePhone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="truncate max-w-xs">{supplier.alternatePhone}</span>
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="truncate max-w-xs">{supplier.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {supplier.address ? (
                          <div className="truncate">{supplier.address}</div>
                        ) : (
                          <div className="text-gray-400 italic">-</div>
                        )}
                        {(supplier.city || supplier.province) && (
                          <div className="text-xs text-gray-500 mt-1">
                            {[supplier.city, supplier.province].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {supplier.createdAt
                          ? new Date(supplier.createdAt).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '-'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {supplier.createdAt
                          ? new Date(supplier.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/suppliers/${supplier.id}`}>
                          <button
                            className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <Link to={`/suppliers/${supplier.id}/edit`}>
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
                            setSupplierToDelete({ id: supplier.id, name: supplier.name });
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

        {/* Pagination */}
        {!isLoading && suppliers.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Menampilkan <span className="font-bold text-gray-900">{suppliers.length}</span> dari{' '}
                <span className="font-bold text-gray-900">{pagination.total}</span> supplier
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
          setSupplierToDelete(null);
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
                Apakah Anda yakin ingin menghapus supplier <strong>{supplierToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-gray-500">
                Tindakan ini akan melakukan soft delete. Data supplier tidak akan muncul di daftar, tetapi masih tersimpan di database.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setSupplierToDelete(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={deleteMutation.isPending}
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (supplierToDelete) {
                  deleteMutation.mutate(supplierToDelete.id);
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

