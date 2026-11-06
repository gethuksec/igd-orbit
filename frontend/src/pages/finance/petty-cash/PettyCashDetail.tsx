import { useState } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  CreditCard,
  Plus,
  CheckCircle,
  XCircle,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react';
import {
  financeService,
  type PettyCashTransaction,
} from '../../../services/finance.service';
import { toast } from 'sonner';

export default function PettyCashDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showReconcileForm, setShowReconcileForm] = useState(false);

  const [transactionForm, setTransactionForm] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_type: 'expense' as 'expense' | 'replenishment',
    amount: 0,
    description: '',
    category: '',
    receipt_url: '',
  });

  const [reconcileForm, setReconcileForm] = useState({
    reconciliation_date: new Date().toISOString().split('T')[0],
    actual_balance: 0,
    notes: '',
  });

  const { data: fund, isLoading, error } = useQuery({
    queryKey: ['petty-cash-fund', id],
    queryFn: () => financeService.getPettyCashFundById(id!),
    enabled: !!id,
  });

  const transactionMutation = useMutation({
    mutationFn: (data: any) => financeService.recordPettyCashTransaction(id!, data),
    onSuccess: () => {
      toast.success('Transaksi berhasil dicatat');
      queryClient.invalidateQueries({ queryKey: ['petty-cash-fund', id] });
      setShowTransactionForm(false);
      setTransactionForm({
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: 'expense',
        amount: 0,
        description: '',
        category: '',
        receipt_url: '',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mencatat transaksi');
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: (data: any) => financeService.reconcilePettyCash(id!, data),
    onSuccess: () => {
      toast.success('Reconcile berhasil');
      queryClient.invalidateQueries({ queryKey: ['petty-cash-fund', id] });
      setShowReconcileForm(false);
      setReconcileForm({
        reconciliation_date: new Date().toISOString().split('T')[0],
        actual_balance: 0,
        notes: '',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal reconcile');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-16 text-center">
          <Loader2 className="w-16 h-16 text-primary-600 dark:text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">Memuat detail petty cash fund...</p>
        </div>
      </div>
    );
  }

  if (error || !fund) {
    return (
      <div className="w-full space-y-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-16 text-center">
          <CreditCard className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">
            {(error as Error)?.message || 'Petty cash fund tidak ditemukan'}
          </p>
          <Link
            to="/finance/petty-cash"
            className="mt-4 inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Petty Cash
          </Link>
        </div>
      </div>
    );
  }

  const totalExpenses =
    fund.transactions?.filter((t) => t.transactionType === 'expense').reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalReplenishments =
    fund.transactions?.filter((t) => t.transactionType === 'replenishment').reduce((sum, t) => sum + t.amount, 0) || 0;

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title="Detail Petty Cash Fund" subtitle="Informasi lengkap kas kecil">
        {fund.isActive && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTransactionForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Record Transaction</span>
              </button>
              <button
                onClick={() => {
                  setReconcileForm({
                    ...reconcileForm,
                    actual_balance: fund.currentBalance,
                  });
                  setShowReconcileForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Reconcile</span>
              </button>
            </div>
          )}
      </BreadcrumbHeader>

      {/* Fund Information */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nomor Fund</label>
            <div className="text-base font-mono font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {fund.fundNumber}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cabang</label>
            <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {fund.branch?.name || '-'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custodian</label>
            <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {fund.custodian?.name || '-'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            {fund.isActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4" />
                Aktif
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                <XCircle className="w-4 h-4" />
                Tidak Aktif
              </span>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Opening Balance</label>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {formatCurrency(fund.openingBalance)}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Balance</label>
            <div
              className={`text-lg font-bold px-4 py-2 rounded-lg border ${
                fund.currentBalance < fund.openingBalance * 0.2
                  ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                  : fund.currentBalance < fund.openingBalance * 0.5
                    ? 'bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
                    : 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
              }`}
            >
              {formatCurrency(fund.currentBalance)}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Periode Mulai</label>
            <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
              {new Date(fund.periodStart).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
          {fund.periodEnd && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Periode Akhir</label>
              <div className="text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                {new Date(fund.periodEnd).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
            </div>
          )}
        </div>

        {/* Balance Alert */}
        {fund.currentBalance < fund.openingBalance * 0.2 && (
          <div className="p-4 bg-red-50 dark:bg-red-950 border-l-4 border-red-500 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200 font-semibold">
                Saldo rendah! Perlu replenishment. Saldo saat ini:{' '}
                {formatCurrency(fund.currentBalance)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-950 rounded-xl">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalExpenses)}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-950 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Replenishments</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalReplenishments)}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-gray-100 dark:border-gray-800 p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          Transactions ({fund.transactions?.length || 0})
        </h3>
        {fund.transactions && fund.transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gradient-to-r from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-gray-100 dark:to-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Tipe
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Deskripsi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Kategori
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                    Jumlah
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                {fund.transactions.map((transaction: PettyCashTransaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 dark:hover:from-gray-900 hover:to-white dark:hover:to-gray-900 transition-all duration-200"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(transaction.transactionDate).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {transaction.transactionType === 'expense' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
                          <TrendingDown className="w-3 h-3" />
                          Expense
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
                          <TrendingUp className="w-3 h-3" />
                          Replenishment
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{transaction.description}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{transaction.category || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div
                        className={`text-sm font-semibold ${
                          transaction.transactionType === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {transaction.transactionType === 'expense' ? '-' : '+'}
                        {formatCurrency(transaction.amount)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-semibold">Belum ada transaksi</p>
          </div>
        )}
      </div>

      {/* Transaction Form Modal */}
      {showTransactionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Record Transaction</h2>
              <button
                onClick={() => setShowTransactionForm(false)}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                transactionMutation.mutate(transactionForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tanggal <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={transactionForm.transaction_date}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, transaction_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipe <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  value={transactionForm.transaction_type}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      transaction_type: e.target.value as 'expense' | 'replenishment',
                    })
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="expense">Expense</option>
                  <option value="replenishment">Replenishment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Jumlah <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={transactionForm.amount || ''}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deskripsi <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <textarea
                  value={transactionForm.description}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, description: e.target.value })
                  }
                  required
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kategori</label>
                <input
                  type="text"
                  value={transactionForm.category}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, category: e.target.value })
                  }
                  placeholder="Opsional"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Receipt URL</label>
                <input
                  type="url"
                  value={transactionForm.receipt_url}
                  onChange={(e) =>
                    setTransactionForm({ ...transactionForm, receipt_url: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTransactionForm(false)}
                  className="px-6 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={transactionMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {transactionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Simpan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Form Modal */}
      {showReconcileForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reconcile Fund</h2>
              <button
                onClick={() => setShowReconcileForm(false)}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reconcileMutation.mutate(reconcileForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tanggal Reconcile <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={reconcileForm.reconciliation_date}
                  onChange={(e) =>
                    setReconcileForm({ ...reconcileForm, reconciliation_date: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Actual Balance <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={reconcileForm.actual_balance || ''}
                  onChange={(e) =>
                    setReconcileForm({
                      ...reconcileForm,
                      actual_balance: parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Current Balance: {formatCurrency(fund.currentBalance)}
                </p>
                {reconcileForm.actual_balance !== fund.currentBalance && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Selisih: {formatCurrency(Math.abs(reconcileForm.actual_balance - fund.currentBalance))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Catatan</label>
                <textarea
                  value={reconcileForm.notes}
                  onChange={(e) => setReconcileForm({ ...reconcileForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Tambahkan catatan (opsional)..."
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReconcileForm(false)}
                  className="px-6 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={reconcileMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {reconcileMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Reconcile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

