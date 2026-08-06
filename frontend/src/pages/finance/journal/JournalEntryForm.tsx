import { useState, useEffect } from 'react';
import { BreadcrumbHeader } from '@/components/shared';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Loader2,
  ReceiptText,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  DollarSign,
} from 'lucide-react';
import { financeService, type ChartOfAccount, type JournalLine } from '../../../services/finance.service';
import { toast } from 'sonner';

export default function JournalEntryForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'manual' as 'manual' | 'auto',
    description: '',
    notes: '',
  });

  const [lines, setLines] = useState<Array<JournalLine & { id?: string }>>([
    { account_id: '', debit_amount: 0, credit_amount: 0, line_description: '' },
    { account_id: '', debit_amount: 0, credit_amount: 0, line_description: '' },
  ]);

  const [accountSearch, setAccountSearch] = useState<Record<number, string>>({});
  const [showAccountDropdown, setShowAccountDropdown] = useState<Record<number, boolean>>({});

  // Fetch existing entry if editing
  const { data: existingEntry, isLoading: loadingEntry } = useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => financeService.getJournalEntryById(id!),
    enabled: isEdit && !!id,
  });

  // Fetch accounts for selection
  const { data: accounts } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => financeService.getChartOfAccounts(),
  });

  // Filter accounts (only transaction accounts, not headers)
  const transactionAccounts = (accounts || []).filter((acc) => !acc.isHeader && acc.isActive);

  useEffect(() => {
    if (existingEntry) {
      setFormData({
        entry_date: existingEntry.entryDate.split('T')[0],
        entry_type: existingEntry.entryType,
        description: existingEntry.description,
        notes: existingEntry.notes || '',
      });
      setLines(
        existingEntry.lines.map((line) => ({
          id: line.id,
          account_id: line.account_id,
          debit_amount: line.debit_amount || 0,
          credit_amount: line.credit_amount || 0,
          line_description: line.line_description || '',
          branch_id: line.branch_id,
          department_id: line.department_id,
        })),
      );
    }
  }, [existingEntry]);

  const mutation = useMutation({
    mutationFn: (data: any) => {
      if (isEdit) {
        return financeService.updateJournalEntry(id!, data);
      }
      return financeService.createJournalEntry(data);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Jurnal berhasil diperbarui' : 'Jurnal berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      navigate('/finance/journal');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal menyimpan jurnal');
    },
  });

  const addLine = () => {
    setLines([...lines, { account_id: '', debit_amount: 0, credit_amount: 0, line_description: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
      const newSearch = { ...accountSearch };
      const newDropdown = { ...showAccountDropdown };
      delete newSearch[index];
      delete newDropdown[index];
      setAccountSearch(newSearch);
      setShowAccountDropdown(newDropdown);
    } else {
      toast.error('Jurnal harus memiliki minimal 2 baris');
    }
  };

  const updateLine = (index: number, field: keyof JournalLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If updating debit, clear credit and vice versa
    if (field === 'debit_amount' && value > 0) {
      newLines[index].credit_amount = 0;
    } else if (field === 'credit_amount' && value > 0) {
      newLines[index].debit_amount = 0;
    }

    setLines(newLines);
  };

  const filteredAccounts = (index: number): ChartOfAccount[] => {
    const search = accountSearch[index]?.toLowerCase() || '';
    if (!search) return transactionAccounts.slice(0, 10);
    return transactionAccounts
      .filter(
        (acc) =>
          acc.code.toLowerCase().includes(search) ||
          acc.name.toLowerCase().includes(search),
      )
      .slice(0, 10);
  };

  const calculateTotalDebit = () => {
    return lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
  };

  const calculateTotalCredit = () => {
    return lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const isBalanced = () => {
    const debit = calculateTotalDebit();
    const credit = calculateTotalCredit();
    return Math.abs(debit - credit) < 0.01;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (lines.length < 2) {
      toast.error('Jurnal harus memiliki minimal 2 baris');
      return;
    }

    const hasEmptyAccount = lines.some((line) => !line.account_id);
    if (hasEmptyAccount) {
      toast.error('Semua baris harus memiliki akun');
      return;
    }

    const hasEmptyAmounts = lines.some(
      (line) => line.debit_amount === 0 && line.credit_amount === 0,
    );
    if (hasEmptyAmounts) {
      toast.error('Setiap baris harus memiliki debit atau credit');
      return;
    }

    const hasBothAmounts = lines.some(
      (line) => line.debit_amount > 0 && line.credit_amount > 0,
    );
    if (hasBothAmounts) {
      toast.error('Setiap baris hanya boleh memiliki debit ATAU credit, tidak keduanya');
      return;
    }

    if (!isBalanced()) {
      toast.error('Total debit harus sama dengan total credit');
      return;
    }

    mutation.mutate({
      entry_date: formData.entry_date,
      entry_type: formData.entry_type,
      description: formData.description,
      notes: formData.notes || undefined,
      lines: lines.map((line) => ({
        account_id: line.account_id,
        debit_amount: line.debit_amount || 0,
        credit_amount: line.credit_amount || 0,
        line_description: line.line_description || undefined,
        branch_id: line.branch_id || undefined,
        department_id: line.department_id || undefined,
      })),
    });
  };

  if (loadingEntry) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
      </div>
    );
  }

  const totalDebit = calculateTotalDebit();
  const totalCredit = calculateTotalCredit();
  const balance = totalDebit - totalCredit;

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <BreadcrumbHeader title={isEdit ? 'Edit Jurnal' : 'Buat Jurnal Baru'} subtitle="Buat atau edit jurnal akuntansi" />

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Entry Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-primary-600" />
            Informasi Jurnal
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tanggal <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipe <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.entry_type}
                onChange={(e) =>
                  setFormData({ ...formData, entry_type: e.target.value as 'manual' | 'auto' })
                }
                required
                disabled={isEdit}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="manual">Manual</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                placeholder="Masukkan deskripsi jurnal..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Tambahkan catatan (opsional)..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Journal Lines */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              Journal Lines ({lines.length})
            </h2>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Baris</span>
            </button>
          </div>

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
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {lines.map((line, index) => {
                  const selectedAccount = transactionAccounts.find(
                    (acc) => acc.id === line.account_id,
                  );
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="relative">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                              type="text"
                              value={
                                selectedAccount
                                  ? `${selectedAccount.code} - ${selectedAccount.name}`
                                  : accountSearch[index] || ''
                              }
                              onChange={(e) => {
                                setAccountSearch({ ...accountSearch, [index]: e.target.value });
                                setShowAccountDropdown({ ...showAccountDropdown, [index]: true });
                              }}
                              onFocus={() =>
                                setShowAccountDropdown({ ...showAccountDropdown, [index]: true })
                              }
                              placeholder="Cari akun..."
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                          </div>
                          {showAccountDropdown[index] && filteredAccounts(index).length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {filteredAccounts(index).map((account) => (
                                <button
                                  key={account.id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    updateLine(index, 'account_id', account.id);
                                    setAccountSearch({ ...accountSearch, [index]: '' });
                                    setShowAccountDropdown({ ...showAccountDropdown, [index]: false });
                                  }}
                                  className="w-full px-4 py-2 text-left hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                >
                                  <div className="font-medium text-gray-900">{account.name}</div>
                                  <div className="text-xs text-gray-500 font-mono">
                                    {account.code} - {account.accountType}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={line.line_description || ''}
                          onChange={(e) =>
                            updateLine(index, 'line_description', e.target.value)
                          }
                          placeholder="Deskripsi baris..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.debit_amount || 0}
                          onChange={(e) =>
                            updateLine(index, 'debit_amount', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                          placeholder="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={line.credit_amount || 0}
                          onChange={(e) =>
                            updateLine(index, 'credit_amount', parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                          placeholder="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 font-bold">
                  <td colSpan={2} className="px-4 py-3 text-right">
                    <span className="text-gray-900">Total:</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-gray-900 ${!isBalanced() ? 'text-red-600' : ''}`}>
                      {formatCurrency(totalDebit)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-gray-900 ${!isBalanced() ? 'text-red-600' : ''}`}>
                      {formatCurrency(totalCredit)}
                    </span>
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Balance Status */}
          <div className="mt-4 p-4 rounded-lg border-2">
            {isBalanced() ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border-green-200">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Jurnal seimbang</span>
                <span className="ml-auto">
                  Debit: {formatCurrency(totalDebit)} = Credit: {formatCurrency(totalCredit)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 border-red-200">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold">Jurnal tidak seimbang!</span>
                <span className="ml-auto">
                  Selisih: {formatCurrency(Math.abs(balance))} (
                  {balance > 0 ? 'Debit lebih besar' : 'Credit lebih besar'})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/finance/journal')}
              className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !isBalanced()}
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

