import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, ArrowLeft, CreditCard, Search } from 'lucide-react';
import { financeService } from '../../../services/finance.service';
import { toast } from 'sonner';
import { useBranchStore } from '@/stores/branchStore';
import { api } from '../../../services/api';

export default function PettyCashFundForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentBranchId, availableBranches } = useBranchStore();

  const [formData, setFormData] = useState({
    fund_number: '',
    branch_id: currentBranchId || '',
    opening_balance: 0,
    custodian_id: '',
    period_start: new Date().toISOString().split('T')[0],
    period_end: '',
  });

  const [custodianSearch, setCustodianSearch] = useState('');
  const [showCustodianDropdown, setShowCustodianDropdown] = useState(false);

  // Fetch users for custodian selection
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data.data || res.data || [];
    },
  });

  const filteredCustodians = (users || []).filter((user: any) => {
    if (!custodianSearch) return true;
    const search = custodianSearch.toLowerCase();
    return (
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.username?.toLowerCase().includes(search)
    );
  }).slice(0, 10);

  const selectedCustodian = users?.find((u: any) => u.id === formData.custodian_id);

  const mutation = useMutation({
    mutationFn: (data: any) => financeService.createPettyCashFund(data),
    onSuccess: () => {
      toast.success('Petty cash fund berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] });
      navigate('/finance/petty-cash');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal membuat petty cash fund');
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.branch_id) {
      toast.error('Cabang wajib dipilih');
      return;
    }

    if (!formData.custodian_id) {
      toast.error('Custodian wajib dipilih');
      return;
    }

    if (formData.opening_balance <= 0) {
      toast.error('Opening balance harus lebih dari 0');
      return;
    }

    mutation.mutate({
      fund_number: formData.fund_number || undefined,
      branch_id: formData.branch_id,
      opening_balance: formData.opening_balance,
      custodian_id: formData.custodian_id,
      period_start: formData.period_start,
      period_end: formData.period_end || undefined,
    });
  };

  return (
    <div className="w-full space-y-3">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/finance/petty-cash')}
              className="p-2 text-white/80 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold mb-1">Buat Petty Cash Fund</h1>
              <p className="text-primary-100">Buat fund kas kecil baru</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Fund Information */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-600" />
            Informasi Fund
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nomor Fund</label>
              <input
                type="text"
                value={formData.fund_number}
                onChange={(e) => setFormData({ ...formData, fund_number: e.target.value })}
                placeholder="Auto-generate jika kosong"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cabang <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.branch_id}
                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Pilih Cabang</option>
                {availableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Balance <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.opening_balance || ''}
                onChange={(e) =>
                  setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })
                }
                required
                min="0"
                step="0.01"
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {formData.opening_balance > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatCurrency(formData.opening_balance)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custodian <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={
                    selectedCustodian
                      ? `${selectedCustodian.name} (${selectedCustodian.email || selectedCustodian.username})`
                      : custodianSearch
                  }
                  onChange={(e) => {
                    setCustodianSearch(e.target.value);
                    setShowCustodianDropdown(true);
                  }}
                  onFocus={() => setShowCustodianDropdown(true)}
                  placeholder="Cari custodian..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                {showCustodianDropdown && filteredCustodians.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCustodians.map((user: any) => (
                      <button
                        key={user.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFormData({ ...formData, custodian_id: user.id });
                          setCustodianSearch('');
                          setShowCustodianDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-primary-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">
                          {user.email || user.username} - {user.role?.name || '-'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Periode Mulai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.period_start}
                onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Periode Akhir</label>
              <input
                type="date"
                value={formData.period_end}
                onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Kosongkan jika tidak ada batas akhir</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/finance/petty-cash')}
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

