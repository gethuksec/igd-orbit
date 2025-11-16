import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Filter,
  TrendingUp,
  Award,
  Crown,
  Sparkles,
} from 'lucide-react';
import { customersService } from '../../services/customers.service';

export default function CustomerList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', page, searchTerm, selectedTier],
    queryFn: () =>
      customersService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        tier: selectedTier !== 'ALL' ? selectedTier : undefined,
      }),
  });

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
  }, [searchTerm, selectedTier]);

  const customers = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };


  const getTierColor = (tier: { code: string; name: string } | null) => {
    if (!tier) return 'bg-gray-100 text-gray-700 border-gray-300';
    const tierCode = tier.code.toUpperCase();
    switch (tierCode) {
      case 'PLATINUM':
        return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-600';
      case 'GOLD':
        return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-white border-yellow-500';
      case 'SILVER':
        return 'bg-gradient-to-r from-gray-300 to-gray-400 text-white border-gray-400';
      case 'REGULAR':
        return 'bg-gradient-to-r from-blue-400 to-blue-500 text-white border-blue-500';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getTierIcon = (tier: { code: string; name: string } | null) => {
    if (!tier) return null;
    const tierCode = tier.code.toUpperCase();
    switch (tierCode) {
      case 'PLATINUM':
        return <Crown className="w-4 h-4" />;
      case 'GOLD':
        return <Award className="w-4 h-4" />;
      case 'SILVER':
        return <Sparkles className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const goldPlatinumCount = customers.filter((c) => c.tier && (c.tier.code === 'GOLD' || c.tier.code === 'PLATINUM')).length;
  const regularSilverCount = customers.filter((c) => c.tier && (c.tier.code === 'REGULAR' || c.tier.code === 'SILVER')).length;

  return (
    <div className="w-full space-y-3">
      {/* Page Header - Enhanced */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manajemen Pelanggan</h1>
            <p className="text-primary-100 text-lg">Kelola data pelanggan dan riwayat transaksi</p>
          </div>
          <Link to="/customers/new">
            <button className="flex items-center gap-2 px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-all shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />
              <span>Tambah Pelanggan</span>
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

      {/* Stats Cards - Enhanced */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Total Pelanggan</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : pagination.total}</h3>
          <p className="text-xs text-gray-500">Semua pelanggan terdaftar</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl group-hover:scale-110 transition-transform">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Gold & Platinum</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : goldPlatinumCount}</h3>
          <p className="text-xs text-gray-500">Pelanggan premium</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">Regular & Silver</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">{isLoading ? '-' : regularSilverCount}</h3>
          <p className="text-xs text-gray-500">Pelanggan standar</p>
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

          <div className="lg:w-64">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tier</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white transition-all"
              >
                <option value="ALL">Semua Tier</option>
                <option value="REGULAR">Regular</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Table - Enhanced */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Pelanggan
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Kontak
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Alamat
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
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
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-base font-semibold text-gray-900">{customer.name}</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">{customer.customerCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{customer.phone}</span>
                        </div>
                        {customer.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="truncate max-w-xs">{customer.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm text-gray-600 max-w-md truncate">
                        {customer.address || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${getTierColor(
                          customer.tier,
                        )}`}
                      >
                        {getTierIcon(customer.tier)}
                        {customer.tier?.name || 'No Tier'}
                      </span>
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
    </div>
  );
}
