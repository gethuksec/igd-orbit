import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { financeService, type Expense } from '../../../services/finance.service';
import { useBranchStore } from '@/stores/branchStore';

export default function ExpensesList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const { currentBranchId } = useBranchStore();

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedStatus, startDate, endDate, currentBranchId]);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, selectedStatus, startDate, endDate, currentBranchId],
    queryFn: () =>
      financeService.getExpenses({
        page,
        limit,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        branchId: currentBranchId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const expenses = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const filteredExpenses = expenses.filter((expense: Expense) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      expense.expenseNumber.toLowerCase().includes(search) ||
      expense.description.toLowerCase().includes(search) ||
      expense.expenseCategory.toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'paid':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'paid':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <Wallet className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Pengeluaran</h1>
            <p className="text-primary-100 text-lg">Kelola pengeluaran dan biaya</p>
          </div>
          <Link
            to="/finance/expenses/new"
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pengeluaran</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor atau deskripsi..."
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base appearance-none bg-white"
            >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Dari Tanggal"
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Sampai Tanggal"
              className="block w-full pl-12 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base transition-all"
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Nomor
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Kategori
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Deskripsi
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Jumlah
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat pengeluaran...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Wallet className="w-16 h-16 text-gray-400" />
                      <p className="text-gray-600 font-semibold text-lg">Tidak ada pengeluaran ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense: Expense) => (
                  <tr
                    key={expense.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-sm font-semibold text-gray-900">
                        {expense.expenseNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(expense.expenseDate).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {expense.expenseCategory}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {expense.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(expense.totalAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                          expense.status,
                        )}`}
                      >
                        {getStatusIcon(expense.status)}
                        {expense.status === 'pending'
                          ? 'Pending'
                          : expense.status === 'approved'
                            ? 'Approved'
                            : expense.status === 'rejected'
                              ? 'Rejected'
                              : 'Paid'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        to={`/finance/expenses/${expense.id}`}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        <Eye className="w-4 h-4" />
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
        {!isLoading && filteredExpenses.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Menampilkan <span className="font-bold text-gray-900">{filteredExpenses.length}</span>{' '}
                dari <span className="font-bold text-gray-900">{pagination.total}</span> pengeluaran
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

