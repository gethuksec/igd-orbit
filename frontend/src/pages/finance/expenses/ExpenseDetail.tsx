import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  DollarSign,
} from 'lucide-react';
import { financeService } from '../../../services/finance.service';
import { toast } from 'sonner';

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: expense, isLoading, error } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => financeService.getExpenseById(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: (data: { notes?: string }) => financeService.approveExpense(id!, data),
    onSuccess: () => {
      toast.success('Pengeluaran berhasil disetujui');
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyetujui pengeluaran');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (data: { rejection_reason: string }) => financeService.rejectExpense(id!, data),
    onSuccess: () => {
      toast.success('Pengeluaran berhasil ditolak');
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menolak pengeluaran');
    },
  });

  const payMutation = useMutation({
    mutationFn: (data: {
      payment_date: string;
      payment_method: 'cash' | 'transfer' | 'petty-cash';
      bank_account_id?: string;
      notes?: string;
    }) => financeService.payExpense(id!, data),
    onSuccess: () => {
      toast.success('Pengeluaran berhasil dibayar');
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membayar pengeluaran');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

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

  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">Memuat detail pengeluaran...</p>
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-16 text-center">
          <Wallet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold text-lg">
            {(error as Error)?.message || 'Pengeluaran tidak ditemukan'}
          </p>
          <Link
            to="/finance/expenses"
            className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Pengeluaran
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/finance/expenses"
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold mb-1">Detail Pengeluaran</h1>
              <p className="text-primary-100">Informasi lengkap pengeluaran</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expense.status === 'pending' && (
              <>
                <Link
                  to={`/finance/expenses/${expense.id}/edit`}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </Link>
                <button
                  onClick={() => {
                    const notes = prompt('Tambahkan catatan persetujuan (opsional):');
                    if (notes !== null) {
                      approveMutation.mutate({ notes: notes || undefined });
                    }
                  }}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Masukkan alasan penolakan:');
                    if (reason) {
                      rejectMutation.mutate({ rejection_reason: reason });
                    }
                  }}
                  disabled={rejectMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  <span>Reject</span>
                </button>
              </>
            )}
            {expense.status === 'approved' && (
              <button
                onClick={() => {
                  const paymentMethod = prompt('Payment method (cash/transfer/petty-cash):');
                  if (paymentMethod && ['cash', 'transfer', 'petty-cash'].includes(paymentMethod)) {
                    payMutation.mutate({
                      payment_date: new Date().toISOString().split('T')[0],
                      payment_method: paymentMethod as 'cash' | 'transfer' | 'petty-cash',
                    });
                  }
                }}
                disabled={payMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
              >
                {payMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DollarSign className="w-4 h-4" />
                )}
                <span>Pay</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expense Information */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nomor Pengeluaran</label>
            <div className="text-base font-mono font-semibold text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {expense.expenseNumber}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
            <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {new Date(expense.expenseDate).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Kategori</label>
            <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {expense.expenseCategory}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${getStatusColor(
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
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
            <div className="text-base font-semibold text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {formatCurrency(expense.amount)}
            </div>
          </div>
          {expense.taxAmount && expense.taxAmount > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pajak</label>
              <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {formatCurrency(expense.taxAmount)}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Total</label>
            <div className="text-lg font-bold text-primary-600 bg-primary-50 px-4 py-2 rounded-lg border border-primary-200">
              {formatCurrency(expense.totalAmount)}
            </div>
          </div>
          {expense.paymentMethod && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
              <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {expense.paymentMethod === 'cash'
                  ? 'Cash'
                  : expense.paymentMethod === 'transfer'
                    ? 'Transfer'
                    : 'Petty Cash'}
              </div>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
            <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              {expense.description}
            </div>
          </div>
          {expense.notes && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
              <div className="text-base text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {expense.notes}
              </div>
            </div>
          )}
          {expense.rejectionReason && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Alasan Penolakan</label>
              <div className="text-base text-red-900 bg-red-50 px-4 py-2 rounded-lg border border-red-200">
                {expense.rejectionReason}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Dibuat:</span>
            <span className="ml-2 text-gray-900">
              {new Date(expense.createdAt).toLocaleString('id-ID')}
            </span>
          </div>
          {expense.approvedAt && (
            <div>
              <span className="text-gray-600">Disetujui:</span>
              <span className="ml-2 text-gray-900">
                {new Date(expense.approvedAt).toLocaleString('id-ID')}
              </span>
            </div>
          )}
          {expense.rejectedAt && (
            <div>
              <span className="text-gray-600">Ditolak:</span>
              <span className="ml-2 text-gray-900">
                {new Date(expense.rejectedAt).toLocaleString('id-ID')}
              </span>
            </div>
          )}
          {expense.paidAt && (
            <div>
              <span className="text-gray-600">Dibayar:</span>
              <span className="ml-2 text-gray-900">
                {new Date(expense.paidAt).toLocaleString('id-ID')}
              </span>
            </div>
          )}
          <div>
            <span className="text-gray-600">Diperbarui:</span>
            <span className="ml-2 text-gray-900">
              {new Date(expense.updatedAt).toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

