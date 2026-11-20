import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Eye,
  Loader2,
  ReceiptText,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { financeService, type JournalEntry } from '../../../services/finance.service';
import { BreadcrumbHeader, FilterToolbar } from '@/components/shared';

export default function JournalEntriesList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedStatus, selectedType, startDate, endDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', page, selectedStatus, selectedType, startDate, endDate],
    queryFn: () =>
      financeService.getJournalEntries({
        page,
        limit,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        entryType: selectedType !== 'all' ? selectedType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const entries = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const filteredEntries = entries.filter((entry: JournalEntry) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      entry.entryNumber.toLowerCase().includes(search) ||
      entry.description.toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      case 'posted':
        return 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'locked':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Clock className="w-4 h-4" />;
      case 'posted':
        return <CheckCircle className="w-4 h-4" />;
      case 'locked':
        return <XCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotalDebit = (entry: JournalEntry) => {
    return entry.lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
  };

  const calculateTotalCredit = (entry: JournalEntry) => {
    return entry.lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Jurnal Umum" subtitle="Kelola jurnal akuntansi">
        <Link
            to="/finance/journal/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Jurnal</span>
          </Link>
      </BreadcrumbHeader>

      {/* Filters */}
      <FilterToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nomor atau deskripsi..."
        fields={[
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'posted', label: 'Posted' },
              { value: 'locked', label: 'Locked' },
            ],
          },
          {
            key: 'type',
            label: 'Tipe',
            type: 'select',
            options: [
              { value: 'manual', label: 'Manual' },
              { value: 'auto', label: 'Auto' },
            ],
          },
          { key: 'date', label: 'Tanggal', type: 'date-range' },
        ]}
        values={{
          status: selectedStatus === 'all' ? '' : selectedStatus,
          type: selectedType === 'all' ? '' : selectedType,
          dateFrom: startDate,
          dateTo: endDate,
        }}
        onFieldChange={(key, v) => {
          if (key === 'status') {
            setSelectedStatus((v || 'all') as any);
            setPage(1);
          }
          if (key === 'type') {
            setSelectedType((v || 'all') as any);
            setPage(1);
          }
          if (key === 'dateFrom') {
            setStartDate(v);
            setPage(1);
          }
          if (key === 'dateTo') {
            setEndDate(v);
            setPage(1);
          }
        }}
        onReset={() => {
          setSelectedStatus('all');
          setSelectedType('all');
          setStartDate('');
          setEndDate('');
          setPage(1);
        }}
      />

      {/* Entries Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Nomor
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Deskripsi
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Tipe
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Debit
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Credit
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 dark:text-primary-400 animate-spin" />
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Memuat jurnal...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <ReceiptText className="w-16 h-16 text-gray-400 dark:text-gray-500" />
                      <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Tidak ada jurnal ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry: JournalEntry) => {
                  const totalDebit = calculateTotalDebit(entry);
                  const totalCredit = calculateTotalCredit(entry);
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/finance/journal/${entry.id}`}
                          className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 hover:underline"
                        >
                          {entry.entryNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {new Date(entry.entryDate).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate">
                          {entry.description}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-medium">
                          {entry.entryType === 'manual' ? 'Manual' : 'Auto'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(totalDebit)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(totalCredit)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            entry.status,
                          )}`}
                        >
                          {getStatusIcon(entry.status)}
                          {entry.status === 'draft'
                            ? 'Draft'
                            : entry.status === 'posted'
                              ? 'Posted'
                              : 'Locked'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <Link
                          to={`/finance/journal/${entry.id}`}
                          className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Detail</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && filteredEntries.length > 0 && (
          <div className="bg-gradient-to-r from-gray-50 dark:from-gray-900 to-gray-100 dark:to-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan <span className="font-bold text-gray-900 dark:text-gray-100">{filteredEntries.length}</span>{' '}
                dari <span className="font-bold text-gray-900 dark:text-gray-100">{pagination.total}</span> jurnal
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  (Halaman {pagination.page} dari {pagination.totalPages})
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                  className="px-5 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
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

