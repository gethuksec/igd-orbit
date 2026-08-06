import { useState, useEffect } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Loader2,
  Wallet,
  Search,
  DollarSign,
} from 'lucide-react';
import { financeService, type ChartOfAccount } from '../../../services/finance.service';
import { toast } from 'sonner';
import { useBranchFilter, BranchFilterSelect } from '@/components/branch/BranchFilter';

export default function ExpenseForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;
  const { branchId } = useBranchFilter();

  const [formData, setFormData] = useState({
    expense_category: '',
    expense_date: new Date().toISOString().split('T')[0],
    amount: 0,
    tax_amount: 0,
    payment_method: 'cash' as 'cash' | 'transfer' | 'petty-cash',
    bank_account_id: '',
    branch_id: branchId || '',
    gl_account_id: '',
    description: '',
    receipt_url: '',
    notes: '',
  });

  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // Fetch existing expense if editing
  const { data: existingExpense, isLoading: loadingExpense } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => financeService.getExpenseById(id!),
    enabled: isEdit && !!id,
  });

  // Fetch expense accounts
  const { data: expenseAccounts } = useQuery({
    queryKey: ['chart-of-accounts', 'EXPENSE'],
    queryFn: () => financeService.getChartOfAccountsByType('EXPENSE'),
  });

  useEffect(() => {
    if (existingExpense) {
      setFormData({
        expense_category: existingExpense.expenseCategory,
        expense_date: existingExpense.expenseDate.split('T')[0],
        amount: existingExpense.amount,
        tax_amount: existingExpense.taxAmount || 0,
        payment_method: existingExpense.paymentMethod || 'cash',
        bank_account_id: existingExpense.bankAccountId || '',
        branch_id: existingExpense.branchId || branchId || '',
        gl_account_id: existingExpense.glAccountId,
        description: existingExpense.description,
        receipt_url: existingExpense.receiptUrl || '',
        notes: existingExpense.notes || '',
      });
    }
  }, [existingExpense, branchId]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) {
        return financeService.updateExpense(id!, data);
      }
      return financeService.createExpense(data);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Pengeluaran berhasil diperbarui' : 'Pengeluaran berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      navigate('/finance/expenses');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyimpan pengeluaran');
    },
  });

  const filteredAccounts = (): ChartOfAccount[] => {
    if (!expenseAccounts) return [];
    const search = accountSearch.toLowerCase();
    if (!search) return expenseAccounts.slice(0, 10);
    return expenseAccounts
      .filter(
        (acc) =>
          acc.code.toLowerCase().includes(search) ||
          acc.name.toLowerCase().includes(search),
      )
      .slice(0, 10);
  };

  const selectedAccount = expenseAccounts?.find((acc) => acc.id === formData.gl_account_id);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalAmount = formData.amount + (formData.tax_amount || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.expense_category) {
      toast.error('Kategori wajib diisi');
      return;
    }

    if (!formData.gl_account_id) {
      toast.error('GL Account wajib dipilih');
      return;
    }

    if (formData.amount <= 0) {
      toast.error('Jumlah harus lebih dari 0');
      return;
    }

    if (!formData.description) {
      toast.error('Deskripsi wajib diisi');
      return;
    }

    mutation.mutate({
      expense_category: formData.expense_category,
      expense_date: formData.expense_date,
      amount: formData.amount,
      tax_amount: formData.tax_amount > 0 ? formData.tax_amount : undefined,
      payment_method: formData.payment_method,
      bank_account_id: formData.bank_account_id || undefined,
      branch_id: formData.branch_id || undefined,
      gl_account_id: formData.gl_account_id,
      description: formData.description,
      receipt_url: formData.receipt_url || undefined,
      notes: formData.notes || undefined,
    });
  };

  if (loadingExpense) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title={isEdit ? 'Edit Pengeluaran' : 'Buat Pengeluaran Baru'} subtitle="Buat atau edit pengeluaran" />

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Expense Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary-600" />
            Informasi Pengeluaran
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.expense_category}
                onChange={(e) => setFormData({ ...formData, expense_category: e.target.value })}
                required
                placeholder="Contoh: Operasional, Marketing, dll"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                required
                min="0"
                step="0.01"
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pajak</label>
              <input
                type="number"
                value={formData.tax_amount || ''}
                onChange={(e) =>
                  setFormData({ ...formData, tax_amount: parseFloat(e.target.value) || 0 })
                }
                min="0"
                step="0.01"
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GL Account <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={
                    selectedAccount
                      ? `${selectedAccount.code} - ${selectedAccount.name}`
                      : accountSearch
                  }
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    setShowAccountDropdown(true);
                  }}
                  onFocus={() => setShowAccountDropdown(true)}
                  placeholder="Cari expense account..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {showAccountDropdown && filteredAccounts().length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredAccounts().map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData({ ...formData, gl_account_id: account.id });
                          setAccountSearch('');
                          setShowAccountDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{account.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{account.code}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
              <select
                value={formData.payment_method}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payment_method: e.target.value as 'cash' | 'transfer' | 'petty-cash',
                  })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="petty-cash">Petty Cash</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={3}
                placeholder="Masukkan deskripsi pengeluaran..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Receipt URL</label>
              <input
                type="url"
                value={formData.receipt_url}
                onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Tambahkan catatan (opsional)..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary-600" />
            Ringkasan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
              <div className="text-lg font-semibold text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                {formatCurrency(formData.amount)}
              </div>
            </div>
            {formData.tax_amount > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pajak</label>
                <div className="text-lg font-semibold text-gray-900 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {formatCurrency(formData.tax_amount)}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total</label>
              <div className="text-xl font-bold text-primary-600 bg-primary-50 px-4 py-2 rounded-lg border border-primary-200">
                {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/finance/expenses')}
              className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

