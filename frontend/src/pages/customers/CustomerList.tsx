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
  Phone,
  Mail,
  Loader2,
  Upload,
  Download,
  X,
  AlertTriangle,
} from 'lucide-react';
import { customersService } from '../../services/customers.service';
import { toast } from 'sonner';
import { Modal } from '../../components/ui/modal';

export default function CustomerList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<10 | 20 | 50 | 100>(20);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', page, limit, searchTerm, sortBy, sortOrder],
    queryFn: () =>
      customersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        sort: sortBy,
        order: sortOrder,
      }),
  });

  // Fetch statistics separately (from entire database, not paginated)
  const { data: statistics, error: statisticsError } = useQuery({
    queryKey: ['customers-statistics'],
    queryFn: () => customersService.getStatistics(),
  });

  // Handle 403 errors and show required roles
  useEffect(() => {
    if (error && (error as any).response?.status === 403) {
      const errorMessage = (error as any).response?.data?.message || 'Akses ditolak';
      const requiredRoles = (error as any).response?.data?.requiredRoles || [];
      const rolesText = requiredRoles.length > 0 ? `Required roles: ${requiredRoles.join(', ')}` : '';
      toast.error(`${errorMessage}${rolesText ? `. ${rolesText}` : ''}`, {
        duration: 5000,
      });
    }
    if (statisticsError && (statisticsError as any).response?.status === 403) {
      const errorMessage = (statisticsError as any).response?.data?.message || 'Akses ditolak';
      const requiredRoles = (statisticsError as any).response?.data?.requiredRoles || [];
      const rolesText = requiredRoles.length > 0 ? `Required roles: ${requiredRoles.join(', ')}` : '';
      toast.error(`${errorMessage}${rolesText ? `. ${rolesText}` : ''}`, {
        duration: 5000,
      });
    }
  }, [error, statisticsError]);

  // Debug logging
  useEffect(() => {
    if (data) {
      console.log('Customers data:', data);
    }
    if (error) {
      console.error('Customers error:', error);
    }
  }, [data, error]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setPage(1);
      refetch();
    }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const customers = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  // Use statistics from API (entire database) instead of filtered page data
  const totalCustomers = statistics?.total || pagination.total;

  const importMutation = useMutation({
    mutationFn: (file: File) => customersService.import(file),
    onSuccess: (result) => {
      const createdText = result.created > 0 ? `${result.created} dibuat` : '';
      const updatedText = result.updated > 0 ? `${result.updated} diupdate` : '';
      const successText = [createdText, updatedText].filter(Boolean).join(', ');
      const failedText = result.failed > 0 ? `, ${result.failed} gagal` : '';
      
      toast.success(`Import berhasil! ${successText}${failedText}`);
      
      if (result.errors.length > 0) {
        console.error('Import errors:', result.errors);
        const errorDetails = result.errors.slice(0, 5).map((e: any) => `Baris ${e.row}: ${e.error}`).join('; ');
        toast.warning(`Beberapa data gagal: ${errorDetails}${result.errors.length > 5 ? '...' : ''}`);
      }
      
      setShowImportModal(false);
      setImportFile(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mengimport data');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersService.delete(id),
    onSuccess: () => {
      toast.success('Pelanggan berhasil dihapus');
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-statistics'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menghapus pelanggan');
    },
  });

  const handleExport = async () => {
    try {
      await customersService.export({
        page,
        limit,
        search: searchTerm || undefined,
      });
      toast.success('Data berhasil diekspor');
    } catch (error: any) {
      toast.error('Gagal mengekspor data');
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manajemen Pelanggan</h1>
            <p className="text-primary-100 text-lg">Kelola data pelanggan dan riwayat transaksi</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all border border-white/20"
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all border border-white/20"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <Link to="/customers/new">
              <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
                <Plus className="w-5 h-5" />
                <span>Tambah Pelanggan</span>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <p className="text-red-800 font-medium">
            {(error as any).response?.data?.message || (error as Error).message || 'Terjadi kesalahan'}
          </p>
          {(error as any).response?.data?.requiredRoles && (
            <p className="text-red-700 text-sm mt-1">
              Required roles: {(error as any).response.data.requiredRoles.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Stats Cards - Enhanced */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Pelanggan</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : totalCustomers}</h3>
          <p className="text-xs text-gray-500">Semua pelanggan terdaftar</p>
        </div>
      </div>

      {/* Filters & Search - Enhanced */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Cari Pelanggan</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama, telepon, email, atau kode pelanggan..."
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

      {/* Customer Table - Enhanced */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto overflow-y-visible scroll-smooth">
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
                  Telepon & Email
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
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat data pelanggan...</p>
                      <p className="text-sm text-gray-500">Mohon tunggu sebentar</p>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-gray-100 rounded-full">
                        <Users className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada pelanggan ditemukan</p>
                      <p className="text-sm text-gray-500 max-w-md">
                        Coba ubah filter atau kata kunci pencarian. Atau tambahkan pelanggan baru untuk memulai.
                      </p>
                      <Link to="/customers/new">
                        <button className="mt-2 flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-lg font-semibold hover:from-primary-700 hover:to-primary-600 shadow-lg transition-all">
                          <Plus className="w-5 h-5" />
                          <span>Tambah Pelanggan Pertama</span>
                        </button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer: any) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/customers/${customer.id}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity cursor-pointer">
                        <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900 hover:text-primary-600 transition-colors">{customer.name}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{customer.customerCode}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {customer.customerType === 'retail' ? 'Retail' : customer.customerType === 'wholesale' ? 'Wholesale' : 'Corporate'}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{customer.phone}</span>
                        </div>
                        {customer.alternatePhone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="truncate max-w-xs">{customer.alternatePhone}</span>
                          </div>
                        )}
                        {customer.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="truncate max-w-xs">{customer.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {customer.address ? (
                          <div className="truncate">{customer.address}</div>
                        ) : (
                          <div className="text-gray-400 italic">-</div>
                        )}
                        {(customer.city || customer.province) && (
                          <div className="text-xs text-gray-500 mt-1">
                            {[customer.city, customer.province].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.createdAt
                          ? new Date(customer.createdAt).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '-'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {customer.createdAt
                          ? new Date(customer.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </div>
                    </td>
                    <td className="px-8 py-5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/customers/${customer.id}`}>
                          <button
                            className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Lihat Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <Link to={`/customers/${customer.id}/edit`}>
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
                            setCustomerToDelete({ id: customer.id, name: customer.name });
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

        {/* Pagination - Enhanced */}
        {!isLoading && customers.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Menampilkan <span className="font-bold text-gray-900">{customers.length}</span> dari{' '}
                <span className="font-bold text-gray-900">{pagination.total}</span> pelanggan
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

      {/* Import Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Import Pelanggan</h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Pilih File CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportFile(file);
                    }
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Format: CSV dengan header sesuai template
                </p>
              </div>
              {importFile && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium">{importFile.name}</p>
                  <p className="text-xs text-gray-500">{(importFile.size / 1024).toFixed(2)} KB</p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (importFile) {
                      importMutation.mutate(importFile);
                    }
                  }}
                  disabled={!importFile || importMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {importMutation.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengimport...
                    </span>
                  ) : (
                    'Import'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setCustomerToDelete(null);
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
                Apakah Anda yakin ingin menghapus pelanggan <strong>{customerToDelete?.name}</strong>?
              </p>
              <p className="text-xs text-gray-500">
                Tindakan ini akan melakukan soft delete. Data pelanggan tidak akan muncul di daftar, tetapi masih tersimpan di database.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setCustomerToDelete(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              disabled={deleteMutation.isPending}
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (customerToDelete) {
                  deleteMutation.mutate(customerToDelete.id);
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
