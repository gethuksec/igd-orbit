import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  CreditCard,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { financeService, type PettyCashFund } from '../../../services/finance.service';
import { useBranchStore } from '@/stores/branchStore';

export default function PettyCashList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const { currentBranchId } = useBranchStore();

  useEffect(() => {
    setSearchTerm('');
  }, [selectedStatus, currentBranchId]);

  const { data: funds, isLoading } = useQuery({
    queryKey: ['petty-cash-funds', currentBranchId, selectedStatus],
    queryFn: () =>
      financeService.getPettyCashFunds({
        branchId: currentBranchId || undefined,
        isActive: selectedStatus === 'all' ? undefined : selectedStatus === 'active',
      }),
  });

  const filteredFunds = (funds || []).filter((fund: PettyCashFund) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      fund.fundNumber.toLowerCase().includes(search) ||
      fund.branch?.name.toLowerCase().includes(search)
    );
  });

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
            <h1 className="text-4xl font-bold mb-2">Petty Cash</h1>
            <p className="text-primary-100 text-lg">Kelola kas kecil per cabang</p>
          </div>
          <Link
            to="/finance/petty-cash/new"
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Fund</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor fund atau cabang..."
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
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Funds Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 via-gray-50 to-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Nomor Fund
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Cabang
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Custodian
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Opening Balance
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                  Current Balance
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Periode
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
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 text-primary-600 animate-spin" />
                      <p className="text-gray-600 font-semibold text-lg">Memuat petty cash funds...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredFunds.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <CreditCard className="w-16 h-16 text-gray-400" />
                      <p className="text-gray-600 font-semibold text-lg">
                        Tidak ada petty cash fund ditemukan
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFunds.map((fund: PettyCashFund) => (
                  <tr
                    key={fund.id}
                    className="hover:bg-gradient-to-r hover:from-gray-50 hover:to-white transition-all duration-200 border-b border-gray-100"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-sm font-semibold text-gray-900">
                        {fund.fundNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{fund.branch?.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{fund.custodian?.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(fund.openingBalance)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div
                        className={`text-sm font-bold ${
                          fund.currentBalance < fund.openingBalance * 0.2
                            ? 'text-red-600'
                            : fund.currentBalance < fund.openingBalance * 0.5
                              ? 'text-yellow-600'
                              : 'text-green-600'
                        }`}
                      >
                        {formatCurrency(fund.currentBalance)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(fund.periodStart).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {fund.periodEnd && (
                          <>
                            {' - '}
                            {new Date(fund.periodEnd).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fund.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle className="w-4 h-4" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                          <XCircle className="w-4 h-4" />
                          Tidak Aktif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Link
                        to={`/finance/petty-cash/${fund.id}`}
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
      </div>
    </div>
  );
}

