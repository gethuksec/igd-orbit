import { useParams, Link } from 'react-router-dom';
import { BreadcrumbHeader } from '@/components/shared';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  ReceiptText,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  RotateCcw,
  FileText,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { financeService, type JournalEntry } from '../../../services/finance.service';
import { toast } from 'sonner';

export default function JournalEntryDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: entry, isLoading, error } = useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => financeService.getJournalEntryById(id!),
    enabled: !!id,
  });

  const postMutation = useMutation({
    mutationFn: () => financeService.postJournalEntry(id!),
    onSuccess: () => {
      toast.success('Jurnal berhasil di-post');
      queryClient.invalidateQueries({ queryKey: ['journal-entry', id] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mem-post jurnal');
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (data: { reverse_date: string; reason: string }) =>
      financeService.reverseJournalEntry(id!, data),
    onSuccess: () => {
      toast.success('Jurnal berhasil di-reverse');
      queryClient.invalidateQueries({ queryKey: ['journal-entry', id] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal me-reverse jurnal');
    },
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'posted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'locked':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">Memuat detail jurnal...</p>
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
          <ReceiptText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">
            {(error as Error)?.message || 'Jurnal tidak ditemukan'}
          </p>
          <Link
            to="/finance/journal"
            className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Jurnal Umum
          </Link>
        </div>
      </div>
    );
  }

  const totalDebit = calculateTotalDebit(entry);
  const totalCredit = calculateTotalCredit(entry);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Detail Jurnal" subtitle="Informasi lengkap jurnal akuntansi">
        <div className="flex items-center gap-2">
            {entry.status === 'draft' && (
              <Link
                to={`/finance/journal/${entry.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span>Edit</span>
              </Link>
            )}
            {entry.status === 'draft' && (
              <button
                onClick={() => postMutation.mutate()}
                disabled={postMutation.isPending || !isBalanced}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                {postMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>Post</span>
              </button>
            )}
            {entry.status === 'posted' && (
              <button
                onClick={() => {
                  const reason = prompt('Masukkan alasan reverse:');
                  if (reason) {
                    reverseMutation.mutate({
                      reverse_date: new Date().toISOString().split('T')[0],
                      reason,
                    });
                  }
                }}
                disabled={reverseMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                {reverseMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>Reverse</span>
              </button>
            )}
          </div>
      </BreadcrumbHeader>

      {/* Entry Information */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nomor Jurnal</label>
            <div className="text-base font-mono font-semibold text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {entry.entryNumber}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
            <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {new Date(entry.entryDate).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipe</label>
            <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {entry.entryType === 'manual' ? 'Manual' : 'Auto'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${getStatusColor(
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
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
            <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {entry.description}
            </div>
          </div>
          {entry.notes && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
              <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {entry.notes}
              </div>
            </div>
          )}
        </div>

        {/* Balance Check */}
        {!isBalanced && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-800 font-semibold">
                Jurnal tidak seimbang! Debit: {formatCurrency(totalDebit)}, Credit:{' '}
                {formatCurrency(totalCredit)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Journal Lines */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary-600" />
          Journal Lines ({entry.lines.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Account
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Deskripsi
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Debit
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {entry.lines.map((line, index) => (
                <tr
                  key={line.id || index}
                  className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-600">
                        {line.account?.code || '-'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {line.account?.name || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{line.line_description || '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 font-bold">
                <td colSpan={2} className="px-4 py-3 text-right">
                  <span className="text-gray-900">Total:</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-gray-900 ${!isBalanced ? 'text-red-600' : ''}`}>
                    {formatCurrency(totalDebit)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-gray-900 ${!isBalanced ? 'text-red-600' : ''}`}>
                    {formatCurrency(totalCredit)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Dibuat:</span>
            <span className="ml-2 text-gray-900">
              {new Date(entry.createdAt).toLocaleString('id-ID')}
            </span>
          </div>
          {entry.postedAt && (
            <div>
              <span className="text-gray-600">Posted:</span>
              <span className="ml-2 text-gray-900">
                {new Date(entry.postedAt).toLocaleString('id-ID')}
              </span>
            </div>
          )}
          <div>
            <span className="text-gray-600">Diperbarui:</span>
            <span className="ml-2 text-gray-900">
              {new Date(entry.updatedAt).toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

